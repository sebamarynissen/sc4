// # file-index.js
import debugModule from 'debug';
import os from 'node:os';
import { DBPF, FileType } from 'sc4/core';
import { TGIIndex } from 'sc4/utils';
import FileScanner from './file-scanner.js';
import WorkerPool from './worker-pool.js';
import type {
	DBPFJSON,
	Entry,
} from 'sc4/core';
import createLoadComparator from './create-load-comparator.js';
import CorePluginIndex from './core-plugin-index.js';
const debug = debugModule('sc4:plugins:index');
debugModule.formatters.h = (array: number | number[]) => {
	return [array].flat().map(x => '0x'+x.toString(16)).join(', ');
}

// The amount of files we need to scan before we're going to use multithreading.
const MULTITHREAD_LIMIT = 1_000;

type folder = string;
type PluginIndexOptions = {
	scan?: string | string[];
	core?: boolean;
	installation?: folder;
	plugins?: folder;
	mem?: number;
	threads?: number;
};

type GeneralBuildOptions = {
	concurrency?: number;
};

type BuildOptions = GeneralBuildOptions & {
	plugins?: string;
};

// # PluginIndex
// The plugin index is a data structure that scans a list of dbpf files and 
// builds up an index of all files in it by their TGI's. This should mimmick 
// how the game scans the plugins folder as well. We obivously cannot keep 
// everything in memory so we'll keep pointers to where we can find each file 
// **on the disk**. Note: we should make use of node's async nature here so 
// that we can read in as much files as possible in parallel!
export default class PluginIndex extends CorePluginIndex {
	scan: string[] = [];
	options: {
		scan: string[];
		core: boolean;
		installation: folder | undefined;
		plugins: folder | undefined;
		threads: number | undefined;
	};

	// ## constructor(opts)
	constructor(opts: PluginIndexOptions | string | string[] = {}) {

		// Normalize our options first.
		if (typeof opts === 'string') {
			opts = [opts];
		}
		if (Array.isArray(opts)) {
			opts = { scan: opts };
		}
		super({
			mem: os.totalmem(),
			...opts,
		});

		// Store some constructor options so we can read them in later again, 
		// most notably when building the index.
		const {
			scan = '**/*',
			core = true,
			installation = process.env.SC4_INSTALLATION,
			plugins = process.env.SC4_PLUGINS,
			threads,
		} = opts;
		this.options = {
			scan: [scan].flat(),
			core,
			installation,
			plugins,
			threads,
		};

	}

	// ## async getFilesToScan()
	// Returns the array of files to scan, properly sorted in the order that we 
	// will read them in.
	async getFilesToScan(opts: BuildOptions = {}) {

		// Get all files to scan. Note that we do this separately for the core 
		// files and the plugins because plugins *always* need to override core 
		// files.
		let coreFiles: string[] = [];
		let sourceFiles: string[] = [];
		let tasks = [];
		if (this.options.core && this.options.installation) {
			let task = new FileScanner(this.options.installation)
				.walk()
				.then(files => coreFiles = files);
			tasks.push(task);
		}

		// IMPORTANT! If the plugins folder is not specified - nor as an option 
		// to the build() function, nor to the constructor and neither in 
		// process.env.SC4_PLUGINS we **MUST NOT** default to the cwd as that 
		// might cause an enormous amount of files to be scanned when running 
		// inside the user's homedir or something. In that case, we simply don't 
		// scan any plugins!
		let { plugins } = opts;
		if (plugins) {
			let task = new FileScanner(this.options.scan, { cwd: plugins })
				.walk()
				.then(files => files.filter(file => {
					return !file.includes('staging-process');
				}))
				.then(files => sourceFiles = files);
			tasks.push(task);
		}
		await Promise.all(tasks);

		// Sort both the core files and the plugins, but do it separately so 
		// that the plugins *always* override the core files.
		coreFiles.sort(createLoadComparator());
		sourceFiles.sort(createLoadComparator());
		return [...coreFiles, ...sourceFiles];

	}

	// ## async build(opts)
	// Asyncrhonously builds up the file index in the same way that SimCity 4 
	// does. This means that the *load order* of the files is important! We also 
	// need to do some gymnastics to ensure the order is kept when parsing all 
	// the DBPF files in parallel because
	async build(opts: BuildOptions = {}) {

		// Open a new worker pool because we'll be parsing all dbpf files in 
		// separate threads that report to the main thread. However, note that 
		// actual multithreading is only useful when we have a ton of files. 
		// We're already reading in the files itself asynchronously, so even 
		// without multithreading we make use of multiple cores. Starting the 
		// threads has an overhead, so we'll only use multithreading with a very 
		// large amount of files.
		const { plugins = this.options.plugins } = opts;
		const files = await this.getFilesToScan({ plugins });
		debug('Found %d files to scan', files.length);
		let {
			threads = (files.length > MULTITHREAD_LIMIT ? undefined : 0),
		} = this.options;
		const pool = new WorkerPool({ n: threads });
		debug('Using %d threads', threads);

		// Loop all files and then parse them one by one. Note that it's crucial 
		// here to maintain the sort order, so when a file is read in, we don't 
		// just put it in the queue, but we put it in the queue *at the right 
		// position*!
		const queue: Entry[][] = new Array(files.length).fill(undefined);
		let tasks: Promise<DBPF>[] = [];
		for (let i = 0; i < files.length; i++) {
			let file = files[i];
			debug('Start parsing %s', file);
			let task = pool.run({ name: 'index', file }).then((json: DBPFJSON) => {
				let dbpf = new DBPF({ ...json, parse: false });
				let entries: Entry[] = queue[i] = [];
				for (let entry of dbpf) {
					if (entry.tgi.type !== FileType.DIR) entries.push(entry);
				}
			}) as Promise<DBPF>;
			tasks.push(task);
			task.then(() => debug('Done parsing %s', file))
		}
		await Promise.all(tasks);
		pool.close();
		debug('Worker pool closed');

		// Get all entries again in a flat array and then create our index from 
		// it. **IMPORTANT**! We can't create the index with new 
		// TGIIndex(...values) because there might be a *ton* of entries, 
		// causing a stack overflow - JS can only handle that many function 
		// arguments!
		debug('Adding entries to index');
		let flat = queue.flat();
		let entries = this.entries = new TGIIndex(flat.length);
		for (let i = 0; i < flat.length; i++) {
			entries[i] = flat[i];
		}
		debug('Building index');
		entries.build();
		debug('Index built');

	}

}
