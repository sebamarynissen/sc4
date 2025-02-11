// # plugin-index.browser.ts
import CorePluginIndex from './core-plugin-index.js';
import { Glob } from './glob.browser.js';
import { TGIIndex } from 'sc4/utils';
import DirectoryScanOperation from './directory-scan-operation.js';

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
		const {
			installation,
			plugins,
		} = opts;
		if (installation) {
			const glob = new Glob(this.scan, {
				cwd: installation,
				nocase: true,
			});
			const op = new DirectoryScanOperation(this, glob);
			all.push(op.start());
			ops.push(op);
		}

		// Same for the user plugins folder.
		if (plugins) {
			const glob = new Glob(this.scan, {
				cwd: plugins,
				nocase: true,
			});
			const op = new DirectoryScanOperation(this, glob);
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
