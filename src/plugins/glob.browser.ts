// # glob.browser.ts
// This module contains an implementation of the Node.js glob module, but then
// based on the Browser's file system api instead of using Node's fs module -
// which isn't available in the browser obviously.
import { Minimatch } from 'minimatch';

type GlobOptions = {
	cwd: FileSystemDirectoryHandle;
	nocase?: boolean;
};

// # Glob
export class Glob {
	pattern: Minimatch[];
	cwd: FileSystemDirectoryHandle;
	constructor(pattern: string | string[], opts: GlobOptions) {
		const patterns = Array.isArray(pattern) ? [...pattern] : [pattern];
		this.cwd = opts.cwd;
		const mmOptions = {
			nocase: opts.nocase,
		};
		this.pattern = patterns.map((pattern) => {
			return new Minimatch(pattern, mmOptions);
		});
	}

	// ## async walk()
	async walk() {
		const info = new FileInfo(this.cwd, '/');
		const files: File[] = [];
		const tasks: Promise<any>[] = [];
		await readdir(info, (info) => {
			if (this.match(info.path)) {
				if (info.kind === 'directory') return;
				const { handle } = info;
				const task = (handle as FileSystemFileHandle)
					.getFile()
					.then((src) => {
						let file = new File([src], info.path);
						files.push(file);
					});
				tasks.push(task);
			}
		});
		await Promise.all(tasks);
		return files;
	}

	// ## match()
	match(path: string) {
		return this.pattern.some((mm) => mm.match(path));
	}
}

// # readdir()
async function readdir(
	info: FileInfo<FileSystemDirectoryHandle>,
	cb: (info: FileInfo) => any,
) {
	let tasks = [];
	for await (let handle of info.handle.values()) {
		let { name, kind } = handle;
		let path = `${info.path}${name}${kind === 'directory' ? '/' : ''}`;
		let child = new FileInfo(handle, path);
		if (kind === 'directory') {
			tasks.push(
				readdir(child as FileInfo<FileSystemDirectoryHandle>, cb),
			);
		}
		cb(child);
	}
	await Promise.all(tasks);
}

class FileInfo<T extends FileSystemHandle = FileSystemHandle> {
	handle: T;
	kind: FileSystemHandle['kind'];
	path: string;
	constructor(handle: T, path: string) {
		this.handle = handle;
		this.kind = handle.kind;
		this.path = path;
	}
}
