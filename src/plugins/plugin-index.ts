// # file-index.js
import os from 'node:os';
import FileScanner from './file-scanner.js';
import CorePluginIndex, { type PluginIndexOptions as CoreOptions } from './core-plugin-index.js';

type PluginIndexOptions = CoreOptions & {
	installation?: string | undefined;
	plugins?: string | undefined;
};

// # PluginIndex
// The plugin index is a data structure that scans a list of dbpf files and 
// builds up an index of all files in it by their TGI's. This should mimmick 
// how the game scans the plugins folder as well. We obivously cannot keep 
// everything in memory so we'll keep pointers to where we can find each file 
// **on the disk**. Note: we should make use of node's async nature here so 
// that we can read in as much files as possible in parallel!
export default class PluginIndex extends CorePluginIndex {
	installation: string | undefined;
	plugins: string | undefined;

	// ## constructor(opts)
	constructor(opts: PluginIndexOptions = {}) {

		// Normalize our options first.
		super({
			mem: os.totalmem(),
			...opts,
		});

		// Store some constructor options so we can read them in later again, 
		// most notably when building the index.
		const {
			installation = process.env.SC4_INSTALLATION,
			plugins = process.env.SC4_PLUGINS,
		} = opts;
		this.installation = installation;
		this.plugins = plugins;

	}

	// ## createGlob()
	// This method must be implemented when extending a core plugin index. It 
	// should return an async iterable that traverses all dbpfs in a directory 
	// and yields the proper dbpf constructor options - a buffer, a file path or 
	// a File object.
	createGlob(pattern: string | string[], cwd: string) {
		return new FileScanner(pattern, { cwd });
	}

}
