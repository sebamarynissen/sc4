// # dbpf-add-command.ts
import path from 'node:path';
import fs from 'node:fs';
import ora from 'ora';
import { Glob } from 'glob';
import { DBPF, DBPFStream, FileType } from 'sc4/core';
import { attempt } from 'sc4/utils';
import type { TGIArray } from 'sc4/types';
import { SmartBuffer } from 'smart-arraybuffer';

export async function dbpfAdd(
	patterns: string | string[],
	options: AddOperationCommandOptions,
) {
	return await new AddOperation(options).add([patterns].flat());
}

type AddOperationCommandOptions = {
	output: string;
	directory?: string;
};

class AddOperation {
	options: AddOperationCommandOptions;
	file: string;
	cwd: string;
	spinner = ora();
	stream: DBPFStream;
	warnings: string[] = [];
	counter = 0;
	constructor(options: AddOperationCommandOptions) {
		this.options = options;
		let { directory = process.cwd(), output } = options;
		this.cwd = directory;
		this.file = path.resolve(this.cwd, output);
		this.stream = new DBPFStream(this.file);
	}

	// The actual entry point for adding files to a dbpf.
	async add(patterns: string[]) {

		// First we'll scan for all dbpf files that match the patterns.
		this.spinner.start();
		let glob = new Glob(patterns, {
			cwd: this.cwd,
			nocase: true,
			nodir: true,
			absolute: true,
		});
		let files = await glob.walk();

		// Ensure that the directory for our output file exists.
		await fs.promises.mkdir(path.dirname(this.file), { recursive: true });

		// Loop all files sequentially. As we have to write to the DBPF 
		// sequentially anyway, it doesn't make sense to read them in parallel.
		for (let file of files) {

			// If this is a TGI file, it won't be added as is, it's meta 
			// information.
			let ext = path.extname(file).toLowerCase();
			if (ext === '.tgi') {
				continue;
			}

			// If we expect this to be a DBPF file, then treat them as such.
			switch (ext) {
				case '.dat':
				case '.sc4lot':
				case '.sc4desc':
				case '.sc4model': {
					await this.addDbpfFile(file);
					break;
				}
				default: await this.addSingleFile(file);
			}

		}

		// At last seal the dbpf.
		this.spinner.text = 'Selaing dbpf';
		await this.stream.seal();
		this.spinner.succeed(`Added ${this.counter} files to ${this.file}`);
		return this;

	}

	// Adds a non-DBPF file to the output dbpf.
	async addSingleFile(file: string) {
		// Adding this file to the DBPF means that we need to know the tgi 
		// for it. This is stored in a .TGI file metadata - which is how the 
		// reader works as well.
		let meta = `${file}.TGI`;
		const [err, contents] = await attempt(
			() => fs.promises.readFile(meta),
		);
		if (err) {
			if (err.code === 'ENOENT') {
				this.warnings.push(
					`${file} has no .TGI meta file, skipping`,
				);
			} else throw err;
		}

		// Parse the tgi.
		let tgi = parseTGI(contents);
		this.spinner.text = `Adding ${file}`;
		await this.stream.add(tgi, await fs.promises.readFile(file));
		this.counter++;
	}

	// Adds an entire dbpf file to the destination dbpf. Note that this is also 
	// known as *dat packing*.
	async addDbpfFile(file: string) {
		this.spinner.text = `Adding ${file}`;
		let dbpf = new DBPF({ file, parse: false });
		await dbpf.parseAsync();
		for (let entry of dbpf) {

			// Skip the dir entry of course, the destination DBPF will create 
			// its own dir entry.
			if (entry.type === FileType.DIR) continue;

			// Don't parse or decompress the entry, we'll just keep it as is: a 
			// potentially compressed buffer read from the filesystem.
			let buffer = await entry.readRawAsync();
			await this.stream.add(entry.tgi, buffer, {
				compressed: entry.compressed,
				compressedSize: entry.compressedSize,
				fileSize: entry.fileSize,
			});
			this.counter++;

		}
	}

}

function parseTGI(buffer: Uint8Array): TGIArray {
	let reader = SmartBuffer.fromBuffer(buffer);
	let contents = reader.readString('utf8');
	return contents
		.split('\n')
		.map(line => line.trim())
		.filter(line => !!line)
		.map(line => Number(`0x${line}`))
		.slice(0, 3) as TGIArray;
}
