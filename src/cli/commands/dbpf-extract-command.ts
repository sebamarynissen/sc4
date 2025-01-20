// # dbpf-extract-command.ts
import path from 'node:path';
import fs, { type OpenMode, type PathLike } from 'node:fs';
import os from 'node:os';
import ora, { type Ora } from 'ora';
import PQueue from 'p-queue';
import { attempt } from 'sc4/utils';
import { Cohort, DBPF, Exemplar, FileType, type Entry } from 'sc4/core';
import { FileScanner } from 'sc4/plugins';
import type { TGILiteral } from 'sc4/types';
import { Document } from 'yaml';
import logger from '#cli/logger.js';

type DbpfExtractCommandOptions = {
	yaml?: boolean;
	force?: boolean;
	output?: string;
	tgi?: boolean;
} & Partial<TGILiteral>;

// # dbpfExtract(files, options)
export async function dbpfExtract(
	patterns: string | string[],
	options: DbpfExtractCommandOptions,
) {
	return new ExtractOperation(options).extract([patterns].flat());
}

// # ExtractOptions
class ExtractOperation {
	files: string[];
	options: DbpfExtractCommandOptions;
	output: string;
	filter: (entry: Entry) => boolean;
	flag: OpenMode = 'wx';
	spinner: Ora;
	counter = 0;
	warnings: string[] = [];

	// We'll run as much as possible in parallel, but we have to be careful to 
	// not use up too many file handles. 250 is a reasonable limit which still 
	// ensure sufficient concurrency to benefit from parallelization.
	queue = new PQueue({ concurrency: 250 });
	constructor(options: DbpfExtractCommandOptions) {
		this.options = options;
		this.filter = createFilter(options);
		this.flag = options.force ? 'w' : 'wx';
		this.spinner = ora();
		this.output = path.resolve(process.cwd(), options.output ?? '.');
	}

	// Entry point for starting the extraction.
	async extract(patterns: string | string[]) {

		// First we'll scan for all dbpf files that match the patterns.
		this.spinner.start('Scanning for files');
		let glob = new FileScanner(patterns, {
			cwd: process.cwd(),
			absolute: true,
		});
		this.files = await glob.walk();
		if (this.files.length === 0) {
			this.spinner.warn(`No files found that match the pattern ${patterns}`);
			return;
		}

		// Ensure that the output folder exists.
		await fs.promises.mkdir(this.output, { recursive: true });

		// We'll run as much as possible in parallel, so don't loop 
		// sequentially, but in parallel.
		let tasks = [];
		this.spinner.text = `Starting extraction`;
		for (let file of this.files) {
			let task = this.extractSingleFile(file);
			tasks.push(task);
		}
		await Promise.allSettled(tasks);

		// Log the result information.
		let text = `Extracted ${this.counter} files`;
		if (this.warnings.length > 0) {
			this.spinner.warn(text);
		} else {
			this.spinner.succeed(text);
		}
		for (let warning of this.warnings) {
			logger?.warn(warning);
		}

	}

	// # extractSingleFile(file)
	async extractSingleFile(file: string) {

		// DBPF files can be pretty large, so we won't load them all in memory, 
		// but make use of the random file system access.
		let fullPath = path.resolve(process.cwd(), file);
		let dbpf = new DBPF({
			file: fullPath,
			parse: false,
		});
		await dbpf.parseAsync();
		let tasks = [];
		for (let entry of dbpf) {
			if (!this.filter(entry)) continue;
			let { id } = entry;
			let task = this.queue.add(async () => {
				this.spinner.text = `Reading ${id}`;
				let buffer: Uint8Array | string = await entry.decompressAsync();

				// If it's an LTEXT, we just export it as a .txt file, that's 
				// easier.
				let extension = getExtension(entry)
				if (entry.type === FileType.LTEXT) {
					buffer = Buffer.from(String(entry.read()), 'utf8');
				} else if (
					this.options.yaml &&
					(
						entry.isType(FileType.Exemplar) ||
						entry.isType(FileType.Cohort)
					)
				) {
					extension = `${extension}.yaml`;
					buffer = exemplarToYaml(entry.read());
				}
				let basename = `${id}${extension}`;
				let filePath = path.join(this.output, basename);
				let success = await this.write(filePath, buffer);
				if (!success) return;
				this.counter++;

				// Reader generates .TGI files as well when extracting files 
				// from dbpf, so we'll use that convention as well.
				if (!this.options.tgi) return;
				let tgi = entry.tgi.map(nr => `${rawHex(nr)}${os.EOL}`).join('');
				await this.write(`${filePath}.TGI`, tgi);

			});
			tasks.push(task);
		}
		await Promise.all(tasks);

	}

	// # write(file, buffer, warnings)
	// Actually writes away a raw file to the output.
	async write(file: PathLike, buffer: Uint8Array | string) {
		const { flag } = this;
		const [err] = await attempt(
			() => fs.promises.writeFile(file, buffer, { flag }),
		);
		if (!err) return true;
		if (err.code === 'EEXIST') {
			this.warnings.push(`${file} already exists`);
			return false;
		}
		throw err;
	}

}

// # createFilter()
function createFilter(query: Partial<TGILiteral>) {
	return function(entry: Entry) {
		for (let key of ['type', 'group', 'instance'] as const) {
			if (query[key] !== undefined && entry[key] !== query[key]) {
				return false;
			}
		}
		return true;
	}
}

// # rawHex(number)
// Converts a number to the hex notation, but uses uppercase and doesn't prefix 
// with 0x. That's apparently how reader does it.
function rawHex(number: number) {
	return number.toString(16).padStart(8, '0').toUpperCase();
}

// # getExtension(entry)
// Figures out the extension of the entry. We only use an extension for a bunch 
// of known file types, such as png etc.
function getExtension(entry: Entry): string {
	switch (entry.type) {
		case FileType.PNG: return '.png';
		case FileType.Thumbnail: return '.png';
		case FileType.LTEXT: return '.txt';
		case FileType.Exemplar: return '.eqz';
		case FileType.Cohort: return '.cqz';
		case FileType.DIR: return '.dir';
		case FileType.FSH: return '.fsh';
		case FileType.S3D: return '.s3d';
		case FileType.LUA: return '.lua';
		case FileType.XML: return '.xml';
		case FileType.BMP: return '.bmp';
		case FileType.JFIF: return '.jfif';
		case FileType.SC4Path: return '.sc4path';
		case 0x00000000: {

			// Ini files have fixed TGI's apparently, so we'll handle those 
			// first.
			let { group: gid, instance: iid } = entry;
			if (gid === 0x4a87bfe8 && iid === 0x2a87bffc) {
				return '.ini';
			} else if (gid === 0x8a5971c5) {
				if (
					iid === 0x2b563701 ||
					iid === 0x8a5993b9 ||
					iid === 0xaa597172 ||
					iid === 0xea8a1115
				) return '.ini';
			}

			// UI files have Type ID 0x00000000 and can have a resolution as GID.
			if (gid !== 0x8a5971c5 && gid !== 0x4a87bfe8) {
				return '.xml';
			}
		}
		default: return '';

	}
}

// # exemplarToYaml(exemplar)
// Serializes an exemplar to a yaml string.
function exemplarToYaml(exemplar: Exemplar | Cohort) {
	let json = exemplar.toJSON();
	let doc = new Document(json) as any;
	let parent = doc.get('parent', true);
	if (parent) {
		parent.flow = true;
		for (let item of parent.items) {
			item.format = 'HEX';
		}
	}
	for (let item of doc.get('properties', true).items) {
		(item.get('id', true) || {}).format = 'HEX';
		let value = item.get('value', true);
		let type = item.get('type');
		if (value) {
			let shouldCast = ['Uint8', 'Uint16', 'Uint32'];
			if (value.items) {
				if (value.items.length <= 3) value.flow = true;
				if (shouldCast.includes(type)) {
					for (let item of value.items) {
						item.format = 'HEX';
					}
				}
			} else if (shouldCast.includes(type)) {
				value.format = 'HEX';
			}
		}
	}
	return doc.toString();
}
