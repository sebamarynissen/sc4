// # plugin-index.browser.ts
import { DBPF, type Entry } from 'sc4/core';
import CorePluginIndex from './core-plugin-index.js';
import { Glob } from './glob.browser.js';
import { TGIIndex } from 'sc4/utils';

type BuildOptions = {
	installation?: FileSystemDirectoryHandle;
	plugins?: FileSystemDirectoryHandle;
};

// # PluginIndex()
export default class PluginIndex extends CorePluginIndex {

	async build(opts: BuildOptions) {
		const dbpfs: DBPF[] = [];
		const tasks: Promise<any>[] = [];
		const flat: Entry[] = [];
		const readTasks: Promise<any>[] = [];
		if (opts.plugins) {
			const glob = new Glob('**/*.{dat,sc4*}', {
			cwd: opts.plugins,
			nocase: true,
		});
			const task = glob.walk().then(files => {
				const subtasks = files.map(async file => {
					const dbpf = new DBPF(file);
					dbpfs.push(dbpf);
					await dbpf.parseAsync();
					for (let entry of dbpf) {
						flat.push(entry);
					}
				});
				readTasks.push(...subtasks);
			});
			tasks.push(task);
		}

		console.log('Looking for all DBPF files');
		await Promise.all(tasks);
		console.log(`${dbpfs.length} DBPF files found`);

		console.log('Parsing DBPF files');
		await Promise.all(readTasks);
		console.log('All dbpf files parsed');
		console.log(dbpfs);

		// Cool, we're ready to generate the actual index now.
		let entries = this.entries = new TGIIndex(flat.length);
		for (let i = 0; i < flat.length; i++) {
			entries[i] = flat[i];
		}
		console.log('building index');
		entries.build();
		console.log('index built');

	}

}
