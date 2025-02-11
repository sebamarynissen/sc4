// # plugin-index.browser.ts
import { DBPF, FileType, type Entry } from 'sc4/core';
import CorePluginIndex from './core-plugin-index.js';
import { Glob } from './glob.browser.js';
import createLoadComparator from './create-load-comparator.js';
import { TGIIndex } from 'sc4/utils';

type BuildOptions = {
	installation?: FileSystemDirectoryHandle;
	plugins?: FileSystemDirectoryHandle;
};

// # PluginIndex()
export default class PluginIndex extends CorePluginIndex {

	// ## build()
	// Entry point for actually building up the plugin index in the browser. 
	// Note that it may take a lot of time, so that'd why there is a 
	// "BuildProgress" object.
	async build(opts: BuildOptions) {
		const all = [];
		const ops = [];

		// If the installation folder is specified, read it in.
		if (opts.installation) {
			let op = new DirectoryScanOperation(this, opts.installation);
			all.push(op.start());
			ops.push(op);
		}

		// Same for the user plugins folder.
		if (opts.plugins) {
			let op = new DirectoryScanOperation(this, opts.plugins);
			all.push(op.start());
			ops.push(op);
		}

		// Start logging the progress now.
		console.log('Looking for all DBPF files');
		await Promise.all(ops.map(op => op.filesPromise.promise));
		const count = ops.reduce((mem, op) => mem + op.dbpfs.length, 0);
		console.log(`${count} DBPF files found`);

		// Wait for everything to be read, and then build up the actual index.
		const results = await Promise.all(all);
		const flat = results.flat();
		const entries = this.entries = new TGIIndex(flat.length);
		for (let i = 0; i < entries.length; i++) {
			entries[i] = flat[i];
		}
		console.log('Indexing TGIs');
		entries.build();
		console.log('Plugin index built');
		return this;

	}

}

type QueueItem = {
	dbpf: DBPF;
	entries: Entry[];
};

class DirectoryScanOperation {
	index: PluginIndex;
	handle: FileSystemDirectoryHandle;
	dbpfs: DBPF[] = [];
	queue: QueueItem[] = [];
	filesPromise = Promise.withResolvers<DBPF[]>();
	entriesPromise = Promise.withResolvers<Entry[]>();
	constructor(index: PluginIndex, handle: FileSystemDirectoryHandle) {
		this.index = index;
		this.handle = handle;
	}
	async start() {
		const glob = new Glob(this.index.scan, {
			cwd: this.handle,
			nocase: true,
		});

		// First we'll look up all the dbpf files in this folder. Once we have 
		// the files, we can already resolve this promise so that a progress 
		// indicator might show how many files we have found in total, while 
		// being non-blocking to wait for it.
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
