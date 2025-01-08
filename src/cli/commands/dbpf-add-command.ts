// # dbpf-add-command.ts
import path from 'node:path';
import fs from 'node:fs';
import ora from 'ora';
import PQueue from 'p-queue';
import { Glob } from 'glob';
import { DBPF } from 'sc4/core';
import { attempt } from 'sc4/utils';
import type { TGIArray } from 'sc4/types';
import { SmartBuffer } from 'smart-arraybuffer';

export async function dbpfAdd(
	patterns: string | string[],
	options: AddOperationCommandOptions,
) {
	await new AddOperation(options).add([patterns].flat());
}

type AddOperationCommandOptions = {
	output: string;
	directory?: string;
};

class AddOperation {
	options: AddOperationCommandOptions;
	cwd: string;
	queue = new PQueue({ concurrency: 250 });
	spinner = ora();
	dbpf = new DBPF();
	warnings: string[] = [];
	counter = 0;
	constructor(options: AddOperationCommandOptions) {
		this.options = options;
		let { directory = process.cwd() } = options;
		this.cwd = directory;
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

		// Loop all the files and handle them in parallel. Note that we have to 
		// treat dbpf file types differently!
		let tasks = [];
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
				case '.sc4model': tasks.push(this.addDbpfFile(file));
				default: tasks.push(this.addSingleFile(file));
			}

		}
		await Promise.all(tasks);

		// At last save the dbpf.
		let dist = path.resolve(this.cwd, this.options.output);
		await fs.promises.writeFile(dist, this.dbpf.toBuffer());
		this.spinner.succeed(`Added ${this.counter} files to ${dist}`);

	}

	// Adds a non-DBPF file to the output dbpf.
	async addSingleFile(file: string) {
		// Note that we don't blindly start reading the file. We have to put it 
		// in the queue to ensure we don't have too many file handles open at 
		// once.
		await this.queue.add(async () => {

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
			this.dbpf.add(tgi, await fs.promises.readFile(file));
			this.counter++;

		});
	}

	// Adds an entire dbpf file to the destination dbpf. Note that this is also 
	// known as *dat packing*.
	async addDbpfFile(file: string) {
		let dbpf = new DBPF({ file, parse: false });
		await this.queue.add(() => dbpf.parseAsync());
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
