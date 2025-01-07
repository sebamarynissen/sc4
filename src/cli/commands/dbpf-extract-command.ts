// # dbpf-extract-command.ts
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';0
import ora from 'ora';
import PQueue from 'p-queue';
import { Cohort, DBPF, Exemplar, FileType, type Entry } from 'sc4/core';
import type { TGILiteral } from 'sc4/types';
import { Document } from 'yaml';

type DbpfExtractCommandOptions = {
	yaml?: boolean;
} & Partial<TGILiteral>;

export async function dbpfExtract(file: string, options: DbpfExtractCommandOptions) {

	// DBPF files can be pretty large, so we won't load them all in memory, but 
	// make use of the random file system access.
	let fullPath = path.resolve(process.cwd(), file);
	let dbpf = new DBPF({
		file: fullPath,
		parse: false,
	});
	let filter = createFilter(options);

	// Ensure that the output folder exists.
	let output = path.resolve(
		process.cwd(),
		path.basename(file, path.extname(file))
	);
	await fs.promises.mkdir(output, { recursive: true });

	// Run as much as possible in parallel, which means we won't use a simple 
	// loop, but create promises instead, but we have to make sure to not create
	// too many open file handles either, so use a promise queue.
	let queue = new PQueue({ concurrency: 250 });
	let spinner = ora(`Reading ${dbpf.file}`).start();
	await dbpf.parseAsync();
	let counter = 0;
	for (let entry of dbpf) {
		if (!filter(entry)) continue;
		counter++;
		let { id } = entry;
		queue.add(async () => {
			spinner.text = `Reading ${id}`;
			let buffer: Uint8Array | string = await entry.decompressAsync();

			// If it's an LTEXT, we just export it as a .txt file, that's 
			// easier.
			let extension = getExtension(entry)
			if (entry.type === FileType.LTEXT) {
				buffer = Buffer.from(String(entry.read()), 'utf8');
			} else if (
				options.yaml &&
				(
					entry.isType(FileType.Exemplar) ||
					entry.isType(FileType.Cohort)
				)
			) {
				extension = '.yaml';
				buffer = exemplarToYaml(entry.read());
			}
			let basename = `${id}${extension}`;
			let filePath = path.join(output, basename);
			await fs.promises.writeFile(filePath, buffer);

			// Reader generates .TGI files as well when extracting files from 
			// dbpf, so we'll use that convention as well.
			let tgi = entry.tgi.map(nr => `${rawHex(nr)}${os.EOL}`);
			await fs.promises.writeFile(`${filePath}.TGI`, tgi);

		});
	}
	await queue.onIdle();
	spinner.succeed(`Extracted ${counter} files from ${dbpf.file}`);

}

// # rawHex(number)
// Converts a number to the hex notation, but uses uppercase and doesn't prefix 
// with 0x. That's apparently how reader does it.
function rawHex(number: number) {
	return number.toString(16).padStart(8, '0').toUpperCase();
}

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

// # getExtension(entry)
// Figures out the extension of the entry. We only use an extension for a bunch 
// of known file types, such as png etc.
function getExtension(entry: Entry): string {
	switch (entry.type) {
		case FileType.PNG: return '.png';
		case FileType.Thumbnail: return '.png';
		case FileType.LTEXT: return '.txt';
		case FileType.Exemplar: return '.eqz';
		case FileType.Cohort: return '.cohort';
		case FileType.DIR: return '.dir';
		case FileType.FSH: return '.fsh';
		case FileType.S3D: return '.s3d';
		case FileType.LUA: return '.lua';
		case FileType.XML: return '.xml';
		case FileType.SC4Path: return '.sc4path';
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
