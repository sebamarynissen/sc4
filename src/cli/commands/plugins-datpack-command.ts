import { Glob } from 'glob';
import { styleText } from 'node:util';
import logger from '#cli/logger.js';
import { FileScanner, folderToPackageId } from 'sc4/plugins';
import { DBPF, DBPFStream } from 'sc4/core';
import path from 'node:path';
import fs from 'node:fs';
import PQueue from 'p-queue';

// # plugins-datpack-command.ts
type DatPackCommandOptions = {
	directory?: string;
	limit?: number;
};

export async function pluginsDatpack(directory?: string, opts: DatPackCommandOptions = {}) {
	const { limit } = opts;
	const plugins = path.resolve(process.cwd(), directory ?? process.env.SC4_PLUGINS ?? '.');
	const packer = new Datpacker({ limit });
	await packer.scan(plugins);
}

type DatpackerOptions = {
	limit?: number;
};

type Job = {
	folder: string;
	files: string[];
};

class Datpacker {
	limit = 10;
	logger = logger;
	progress: {
		total: number;
		processed: number;
		toString: () => string;
	};

	// ## constructor()
	constructor(opts: DatpackerOptions = {}) {
		const { limit = 10 } = opts;
		this.limit = Math.max(2, limit);
	}

	// ## scan(directory)
	// The entry point for starting the datpacking.
	async scan(directory: string) {

		// First of all we'll prepare all the jobs by looking for all .sc4pac 
		// folders, and then count the amount of files in the folder.
		const folders = new Glob('*/*.sc4pac/', {
			cwd: directory,
			absolute: true,
		});
		const queue = new PQueue({ concurrency: 256 });
		const jobs: Job[] = [];
		let total = 0;
		this.logger.progress.start('Looking for folders to datpack');
		for await (let cwd of folders) {
			queue.add(async () => {
				let glob = new FileScanner('**/*', { cwd });
				let files = await glob.walk();
				if (files.length < this.limit) return;
				jobs.push({
					folder: cwd,
					files,
				});
				total += files.length;
				this.logger.progress.update(
					`Found ${jobs.length} folders to datpack (${total} files, limit: ${this.limit})`,
				);
			});
		}
		await queue.onIdle();

		// Now that we have all jobs, we'll initialize our progress object.
		if (jobs.length === 0) {
			this.logger.progress.succeed(`No folders found to datpack (limit: ${this.limit})`);
			return;
		} else {
			this.logger.progress.succeed();
		}
		this.progress = new Progress({ total, width: 25 });

		// Now actually perform the datpacking. Note: we'll sort the jobs so 
		// that the jobs with the most files get executed *first*. That way we 
		// make sure that we maximize parallelization by avoiding that the long 
		// running jobs are only started in the end.
		jobs.sort((a, b) => b.files.length - a.files.length);
		this.logger.progress.start(this.progress.toString());
		for (let job of jobs) {
			queue.add(() => this.execute(job));
		}
		await queue.onIdle();
		this.logger.progress.succeed('Datpacking completed');
	}

	// ## execute(job)
	// The function that will actually datpack the folder, provided that the 
	// amount of files is above the threshold.
	async execute(job: Job) {

		// Use the file scanner to find all files to be added, which will also 
		// count the files as a bonus.
		const { folder, files } = job;

		// Make sure the files are sorted so that they will be added in the 
		// correct order to the DBPF.
		files.sort();
		let basename = path.basename(folder);
		let output = path.join(folder, `${basename}.dat`);
		let id = styleText('green', folderToPackageId(folder)!);
		let stream = new DBPFStream(output, 'w');
		for (let file of files) {
			let bar = this.progress.toString();
			logger.progress.update(`${bar} Processing ${id}/${path.basename(file)}`)
			let dbpf = new DBPF({ file, parse: false });
			await dbpf.parseAsync();
			await stream.addDbpf(dbpf);
			this.progress.processed++;
		}
		await stream.seal();

		// Remove all files, and then all folders as well - which should be 
		// empty now.
		for (let file of files) {
			await fs.promises.rm(file);
		}
		let deletions = new Glob('*/', {
			cwd: folder,
			absolute: true,
		});
		for await (let folder of deletions) {
			await fs.promises.rm(folder, { recursive: true, force: true });
		}

	}

}

type ProgressOptions = {
	total?: number;
	width?: number;
};

class Progress {
	total = 1;
	processed = 0;
	width = 25;
	constructor(opts: ProgressOptions) {
		this.total = opts.total ?? 1;
		this.width = opts.width ?? 25;
	}
	toString() {
		const { total, processed, width } = this;
		const fraction = processed/total;
		const bar = '='.repeat(Math.round(fraction*width));
		const rest = ' '.repeat(width-bar.length);
		const pct = Math.round(fraction*100);
		return `[${bar}${rest}] ${pct}%`;
	}
}
