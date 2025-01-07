// # dbpf-extract-command.ts
import path from 'node:path';
import fs from 'node:fs';
import ora from 'ora';
import PQueue from 'p-queue';
import { DBPF, FileType, type Entry } from 'sc4/core';
import type { TGILiteral } from 'sc4/types';

type DbpfExtractCommandOptions = {} & Partial<TGILiteral>;

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
			let buffer = await entry.decompressAsync();

			// If it's an LTEXT, we just export it as a .txt file, that's 
			// easier.
			let basename = `${id}${getExtension(entry)}`;
			if (entry.type === FileType.LTEXT) {
				buffer = Buffer.from(String(entry.read()), 'utf8');
			}
			await fs.promises.writeFile(path.join(output, basename), buffer);

		});
	}
	await queue.onIdle();
	spinner.succeed(`Extracted ${counter} files from ${dbpf.file}`);

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
		case FileType.Exemplar: return '.exemplar';
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
