// # file-index.js
import os from 'node:os';
import { DBPF, FileType } from 'sc4/core';
import { TGIIndex } from 'sc4/utils';
import FileScanner from './file-scanner.js';
import type { Entry } from 'sc4/core';
import createLoadComparator from './create-load-comparator.js';
import CorePluginIndex from './core-plugin-index.js';

type folder = string;
type PluginIndexOptions = {
	scan?: string | string[];
	core?: boolean;
	installation?: folder;
	plugins?: folder;
	mem?: number;
	threads?: number;
};

type BuildOptions = {
	installation?: string;
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
	options: {
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
			core = true,
			installation = process.env.SC4_INSTALLATION,
			plugins = process.env.SC4_PLUGINS,
			threads,
		} = opts;
		this.options = {
			core,
			installation,
			plugins,
			threads,
		};

	}

	// ## async build(opts)
	// Asynchronously builds up the file index in the same way that SimCity 4 
	// does. This means that the *load order* of the files is important!
	async build(opts: BuildOptions = {}) {
		const all = [];
		const ops = [];

		// If the installation folder is specified, read it in.
		const {
			plugins = this.options.plugins,
			installation = this.options.installation,
		} = opts;
		if (this.options.core && installation) {
			let op = new DirectoryScanOperation(this, installation);
			all.push(op.start());
			ops.push(op);
		}

		// Same for the user plugins folder.
		if (plugins) {
			let op = new DirectoryScanOperation(this, plugins);
			all.push(op.start());
			ops.push(op);
		}

		// Start logging the progress now.
		await Promise.all(ops.map(op => op.filesPromise.promise));

		// Wait for everything to be read, and then build up the actual index.
		const results = await Promise.all(all);
		const flat = results.flat();
		const entries = this.entries = new TGIIndex(flat.length);
		for (let i = 0; i < entries.length; i++) {
			entries[i] = flat[i];
		}
		entries.build();
		return this;
	}

}

type QueueItem = {
	dbpf: DBPF;
	entries: Entry[];
};

class DirectoryScanOperation {
	index: PluginIndex;
	path: string;
	dbpfs: DBPF[] = [];
	queue: QueueItem[] = [];
	filesPromise = Promise.withResolvers<DBPF[]>();
	entriesPromise = Promise.withResolvers<Entry[]>();
	constructor(index: PluginIndex, path: string) {
		this.index = index;
		this.path = path;
	}
	async start() {

		// First we'll look up all the dbpf files in this folder. Once we have 
		// the files, we can already resolve this promise so that a progress 
		// indicator might show how many files we have found in total, while 
		// being non-blocking to wait for it.
		const glob = new FileScanner(this.index.scan, { cwd: this.path });
		const tasks: Promise<any>[] = [];
		for await (let file of glob) {
			const dbpf = new DBPF(file);
			this.dbpfs.push(dbpf);

			// Immediately start reading in the DBPF.
			const item: QueueItem = { dbpf, entries: [] };
			this.queue.push(item);
			const task = dbpf.parseAsync().then(() => {
				for (let entry of dbpf) {
					if (entry.type !== FileType.DIR) {
						item.entries.push(entry);
					}
				}
			});
			tasks.push(task);

		}
		this.filesPromise.resolve(this.dbpfs);

		// If we reach this point, all dbpfs have been added to the queue and 
		// they have started loading. This means that we can sort them now based 
		// on the load order that is required!
		const compare = createLoadComparator();
		this.queue.sort((a, b) => compare(a.dbpf.filename, b.dbpf.filename));

		// Cool, now wait for the entries to be finished parsing as well. Once 
		// that's done, the queue is properly sorted and contain all entries. 
		// The last thing we have to do hence is flatten the entries. Note that 
		// internally, DBPF's don't use LIFO, but FIFO, meaning that TGI's that 
		// appear *first* in the dbpf actually get preference, so we need to 
		// take this into account!
		await Promise.all(tasks);
		const flat = [];
		for (let { entries } of this.queue) {
			for (let i = entries.length-1; i >= 0; i--) {
				flat.push(entries[i]);
			}
		}
		this.entriesPromise.resolve(flat);
		return flat;

	}
}
