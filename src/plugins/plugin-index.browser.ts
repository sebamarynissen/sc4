// # plugin-index.browser.ts
import CorePluginIndex, { type PluginIndexOptions as CoreOptions } from './core-plugin-index.js';
import { Glob } from './glob.browser.js';

type PluginIndexOptions = CoreOptions & {
	installation?: FileSystemDirectoryHandle;
	plugins?: FileSystemDirectoryHandle;
};

// # PluginIndex()
export default class PluginIndex extends CorePluginIndex {
	installation?: FileSystemDirectoryHandle;
	plugins?: FileSystemDirectoryHandle;
	constructor(opts: PluginIndexOptions = {}) {
		super(opts);
		if (opts.installation) this.installation = opts.installation;
		if (opts.plugins) this.plugins = opts.plugins;
	}

	// ## createGlob()
	// This method must be implemented when extending a core plugin index. It 
	// should return an async iterable that traverses all dbpfs in a directory 
	// and yields the proper dbpf constructor options - a buffer, a file path or 
	// a File object.
	createGlob(pattern: string | string[], cwd: FileSystemDirectoryHandle): Glob {
		return new Glob(pattern, {
			cwd,
			nocase: true,
		});
	}

}
