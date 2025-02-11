// # file-index.js
import os from 'node:os';
import { TGIIndex } from 'sc4/utils';
import FileScanner from './file-scanner.js';
import CorePluginIndex from './core-plugin-index.js';
import DirectoryScanOperation from './directory-scan-operation.js';

type folder = string;
type PluginIndexOptions = {
	scan?: string | string[];
	core?: boolean;
	installation?: folder;
	plugins?: folder;
	mem?: number;
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
		} = opts;
		this.options = {
			core,
			installation,
			plugins,
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
			const glob = new FileScanner(this.scan, { cwd: installation });
			const op = new DirectoryScanOperation(this, glob);
			all.push(op.start());
			ops.push(op);
		}

		// Same for the user plugins folder.
		if (plugins) {
			const glob = new FileScanner(this.scan, { cwd: plugins });
			const op = new DirectoryScanOperation(this, glob);
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
