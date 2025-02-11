// # directory-scan-operation.ts
import { DBPF, FileType, type Entry } from 'sc4/core';
import createLoadComparator from './create-load-comparator.js';
import type PluginIndex from './core-plugin-index.js';

export type Glob = {
	[Symbol.asyncIterator]: () => AsyncGenerator<File | string | Uint8Array, void, void>;
}

type QueueItem = {
	dbpf: DBPF;
	entries: Entry[];
};

export default class DirectoryScanOperation {
	index: PluginIndex;
	glob: Glob;
	dbpfs: DBPF[] = [];
	queue: QueueItem[] = [];
	filesPromise = Promise.withResolvers<DBPF[]>();
	entriesPromise = Promise.withResolvers<Entry[]>();
	constructor(index: PluginIndex, glob: Glob) {
		this.index = index;
		this.glob = glob;
	}
	async start() {

		// First we'll look up all the dbpf files in this folder. Once we have 
		// the files, we can already resolve this promise so that a progress 
		// indicator might show how many files we have found in total, while 
		// being non-blocking to wait for it.
		const tasks: Promise<any>[] = [];
		for await (let file of this.glob) {
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
