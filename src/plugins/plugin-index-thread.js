// # plugin-index-thread.js
// This file runs in a separate thread and is used by the plugin index to 
// parallelize certain tasks.
import { thread } from 'sc4/threading';
import os from 'node:os';
import { DBPF } from 'sc4/core';
import PQueue from 'p-queue';

// Handles incoming messages and starts our tasks.
export default thread(async task => {
	const { name, ...rest } = task;
	return await fns[name](rest);
});

// Main queue that we use for reading files in parallel.
const queue = new PQueue({
	concurrency: Math.floor(512/os.availableParallelism()),
});

// # fns
// An object containing all functions that we expose to the calling thread.
const fns = {

	// ## index(opts)
	// Starts indexing a given file. Note that we won't always wait until the 
	// file has been fully indexed. We do this if the queue is full, which the 
	// thread is no longer able to handle the pressure, so we need to signal to 
	// the parent thread that it needs to back-off for a while.
	async index({ file }) {
		let dbpf = new DBPF({ file, parse: false });
		return await queue.add(async () => {
			await dbpf.parseAsync();
			let { file, header, entries } = dbpf;
			return {
				file,
				header: header.toJSON(),
				entries: [...entries].map(entry => entry.toJSON()),
			};
		});
	},

};
