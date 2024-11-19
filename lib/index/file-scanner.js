// # file-scanner.js
import { Readable } from 'node:stream';
import fs from 'node:fs';
import { Glob } from 'glob';

// # FileScanner
// Helper class that can be used with for await () to get all files from a given 
// scan pattern. Under the hood we just zip multiple globs together.
export default class FileScanner {

	// ## constructor(scan)
	constructor(scan) {
		this.scan = scan;
	}

	// ## [Symbol.asyncIterator]()
	[Symbol.asyncIterator]() {
		const rs = new Readable({
			objectMode: true,
			read() {},
		});
		const tasks = this.scan.map(what => {
			return report(what, file => rs.push({ order: 0, file }));
		});
		Promise.all(tasks).then(() => rs.push(null));
		return rs[Symbol.asyncIterator]();
	}

}

async function report(what, cb) {
	try {
		let info = await fs.promises.stat(what);
		if (info.isDirectory()) {
			let glob = new Glob('**/*.{dat,sc4lot,sc4desc,sc4model}', {
				cwd: what,
				nodir: true,
				nocase: true,
				absolute: true,
			});
			for await (let file of glob) {
				cb(file);
			}
		} else {
			cb(what);
		}
	} catch {}
}
