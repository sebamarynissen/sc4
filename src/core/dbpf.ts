// # dbpf.js
import { compress } from 'qfs-compression';
import { concatUint8Arrays, isUint8Array, uint8ArrayToHex } from 'uint8array-extras';
import Header, { type HeaderJSON, type HeaderOptions } from './dbpf-header.js';
import Entry, { type EntryJSON, type EntryFromType } from './dbpf-entry.js';
import DIR from './dir.js';
import WriteBuffer from './write-buffer.js';
import { cClass, FileType } from './enums.js';
import { fs, TGIIndex, getCompressionInfo } from 'sc4/utils';
import { SmartBuffer } from 'smart-arraybuffer';
import type { TGIArray, TGILiteral, TGIQuery, uint32 } from 'sc4/types';
import type { FindParameters } from 'src/utils/tgi-index.js';
import type { DBPFFile, DecodedFileTypeId, FileTypeId } from './types.js';
import TGI from './tgi.js';

export type DBPFOptions = {
	file?: string | File;
	buffer?: Uint8Array;
	parse?: boolean;
	header?: HeaderOptions;
	entries?: any;
};

export type DBPFSaveOptions = string | {
	file?: string;
};

export type DBPFJSON = {
	file: string;
	header: HeaderJSON;
	entries: EntryJSON;
};

type FileAddOptions = {
	compressed?: boolean;
	compressedSize?: number;
	fileSize?: number;
};

// Older Node version (which we don't actually officially support though) might 
// not have a file global available.
const hasGlobalFileClass = typeof File === 'function';
function isFileObject(file: any): file is File {
	return hasGlobalFileClass && file instanceof File;
}

// # DBPF()
// A class that represents a DBPF file. A DBPF file is basically just a custom 
// file archive format, a bit like .zip etc. as it contains other files that 
// might be compressed etc.
export default class DBPF {
	file: string | null = null;
	fileObject: File | null = null;
	buffer: Uint8Array | null = null;
	header: Header;
	entries: TGIIndex<Entry>;

	// ## constructor(opts)
	// Constructs the dbpf for the given file. For backwards compatibility and 
	// ease of use, a DBPF is synchronous by default, but we should support 
	// async parsing as well: that's important if we're reading in an entire 
	// plugins directory for example. Note that DBPF's are always constructed 
	// from files, **not** from buffers. As such we don't have to keep the 
	// entire buffer in memory and we can read the required parts of the file 
	// "on the fly". That's what the DBPF format was designed for!
	constructor(opts: DBPFOptions | string | Uint8Array | File = {}) {

		// If the file specified is actually a buffer, store that we don't 
		// have a file. Note that this is not recommended: we need to be able 
		// to load and unload DBPFs on the fly because we simply cannot load 
		// them all into memory!
		if (isUint8Array(opts)) {
			this.file = null;
			this.buffer = opts;
			opts = {};
		} else if (typeof opts === 'string') {
			this.file = opts;
			this.buffer = null;
			opts = {};
		} else if (isFileObject(opts)) {
			this.fileObject = opts;
			opts = {};
		} else {
			let { file = null, buffer = null } = opts;
			this.buffer = buffer;
			if (hasGlobalFileClass && file instanceof File) {
				this.file = null;
				this.fileObject = file;
			} else if (typeof file === 'string') {
				this.file = file;
				this.fileObject = null;
			}
		}

		// Create an empty header.
		this.header = new Header(opts.header);

		// Create the index that keeps track of which entry - identified by 
		// TGI - is found where.
		this.entries = new TGIIndex();
		if (opts.entries) {
			for (let json of opts.entries) {
				this.entries.push(new Entry({
					...json,
					dbpf: this,
				}));
			}
		}

		// If the user initialize the DBPF with either a file or a buffer, then 
		// parse immediately.
		let { parse = this.fileObject ? false : true } = opts;
		if (parse && (this.buffer || this.file)) {
			this.parse();
		}

	}

	// ## get length()
	get length() {
		return this.entries.length;
	}

	// ## get dir()
	// Shortcut for accessing the DIR file, which every dbpf should have (at 
	// least when parsed).
	get dir() {
		let entry = this.find({ type: FileType.DIR });
		return entry ? entry.read() : null;
	}

	// ## get filename()
	// Looks up the filename of the dbpf in an agnostic way - meaning that we 
	// don't care about whether it's a file object dbpf or no. We just always 
	// return a string, which is useful for sorting.
	get filename(): string {
		if (this.file) return this.file;
		else if (this.fileObject) return this.fileObject.name;
		else return '';
	}

	// ## find(...args)
	// Proxies to entries.find().
	find<T extends DecodedFileTypeId>(query: TGIQuery<T>): EntryFromType<T> | undefined;
	find<T extends DecodedFileTypeId>(type: T, group: uint32, instance: uint32): EntryFromType<T> | undefined;
	find<T extends FileTypeId>(query: TGIQuery<T>): Entry<Uint8Array> | undefined;
	find<T extends FileTypeId>(type: T, group: uint32, instance: uint32): Entry<Uint8Array> | undefined;
	find(...params: FindParameters<Entry>): Entry | undefined;
	find(...args: FindParameters<Entry>) {
		return this.entries.find(...args as Parameters<TGIIndex<Entry>['find']>);
	}

	// ## findAll(...args)
	// Proxies to entries.findAll()
	findAll<T extends DecodedFileTypeId>(query: TGIQuery<T>): EntryFromType<T>[];
	findAll<T extends DecodedFileTypeId>(type: T, group: uint32, instance: uint32): EntryFromType<T>[];
	findAll<T extends FileTypeId>(query: TGIQuery<T>): Entry<Uint8Array>[];
	findAll<T extends FileTypeId>(type: T, group: uint32, instance: uint32): Entry<Uint8Array>[];
	findAll(...params: FindParameters<Entry>): Entry[]
	findAll(...args: FindParameters<Entry>): Entry[] {
		return this.entries.findAll(...args as Parameters<TGIIndex<Entry>['findAll']>);
	}

	// ## add(tgi, file)
	// Adds the given file to the DBPF with the specified tgi.
	add<T extends DecodedFileTypeId>(tgi: TGILiteral<T> | TGIArray<T>, file: DBPFFile | DBPFFile[], opts?: FileAddOptions): EntryFromType<T>;
	add<T extends FileTypeId>(tgi: TGILiteral<T> | TGIArray<T>, buffer: Uint8Array, opts?: FileAddOptions): Entry;
	add(tgi: TGILiteral | TGIArray, buffer: Uint8Array, opts?: FileAddOptions): Entry;
	add(tgi: TGILiteral | TGIArray , fileOrBuffer: DBPFFile | DBPFFile[] | Uint8Array, opts: FileAddOptions = {}) {
		if (!fileOrBuffer) {
			throw new TypeError(`Added file with tgi ${tgi} is undefined!`);
		}
		let entry = new Entry({ dbpf: this, tgi });
		this.entries.add(entry);
		if (isUint8Array(fileOrBuffer)) {

			// If the buffer is already compressed, we store it as the raw 
			// buffer instead.
			if (opts.compressed) {
				entry.raw = fileOrBuffer;
			} else {
				entry.buffer = fileOrBuffer;
			}

		} else if (fileOrBuffer) {
			entry.file = fileOrBuffer as any;
		}
		let { compressed = false, fileSize = 0, compressedSize = 0 } = opts;
		Object.assign(entry, { compressed, fileSize, compressedSize });
		return entry;
	}

	// ## remove(tgi)
	// Removes a certain entry again.
	remove(query: TGIQuery | TGILiteral): number {
		return this.entries.remove(query);
	}

	// ## free()
	// This method unloads the underlying buffer of the dbpf so that it can be 
	// garbage collected to free up some memory. This is useful if we just 
	// needed the DBPF for indexing but are not planning to use it soon. In 
	// that case the cache can decide to free up the dbpf and only read it in 
	// again upon the next read.
	free() {
		if (!this.file) {
			console.warn([
				'No file is set.',
				'This means you will no longer be able to use this DBPF!',
			].join(' '));
		}

		// Delete the buffer & loop all our entries so that we unload those as 
		// well.
		this.buffer = null;
		for (let entry of this) {
			entry.free();
		}
		return this;

	}

	// ## readBytes(offset, length)
	// Returns a buffer contain the bytes starting at offset and with the 
	// given length. We use this method so that we can use a buffer or a file 
	// as underlying source interchangeably.
	readBytes(offset: number, length: number) {

		// If the buffer was loaded in memory, then it will be fastest to read 
		// from memory of course.
		if (this.buffer) {
			return this.buffer.subarray(offset, offset+length);
		}

		// If we don't have a buffer, but we do have a file path, then we read 
		// that specific part.
		if (this.file) {
			let buffer = new Uint8Array(length);
			let fd = fs!.openSync(this.file, 'r');
			fs!.readSync(fd, buffer, 0, length, offset);
			fs!.closeSync(fd);
			return buffer;
		}

		// If we don't have a file, neither a buffer, but we *do* have a HTML5 
		// file object, we'll notify the user that a file object is set, but 
		// that reading synchronously is not possible.
		if (this.fileObject) {
			throw new Error(
				`DBPF file has a HTML5 file object set, which only allows async reading. Either user async reading, or read in the full buffer instead.`,
			);
		}

		// No file or buffer set? Then we can't read.
		throw new Error(`DBPF file has no buffer, neither file set.`);

	}

	// ## readBytesAsync(offset, length)
	// Same as readBytes, but in an async way. You normally shouldn't use this 
	// for modding tasks, but we use it for reading in large plugin folders in 
	// parallel.
	async readBytesAsync(offset: number, length: number) {
		if (this.buffer) return this.buffer.subarray(offset, offset+length);
		else if (this.fileObject) {
			let slice = this.fileObject.slice(offset, offset+length);
			let arrayBuffer = await slice.arrayBuffer();
			return new Uint8Array(arrayBuffer);
		} else if (this.file) {
			let buffer = new Uint8Array(length);
			let fh = await fs!.promises.open(this.file);
			await fh.read(buffer, 0, length, offset);
			await fh.close();
			return buffer;
		}
		throw new Error(`DBPF file has no buffer, neither file set.`);
	}

	// ## parse()
	// Reads in the DBPF in a *synchronous* way. That's useful if you're 
	// testing stuff out, but for bulk reading you should use the async 
	// reading.
	parse() {
		const header = dataView(this.readBytes(0, 96));
		const offset = header.getUint32(40, true);
		const size = header.getUint32(44, true);
		const index = dataView(this.readBytes(offset, size));
		this.entries = parseEntries(this, header, index);
		return this;
	}

	// ## parseAsync()
	// Parses the DBPF in an async way. Note that we no longer share logic with 
	// the sync parse() method because this we can make things go 
	// *significantly* faster this way.
	async parseAsync() {
		if (this.file) {
			// First we'll read in the header, but crucially, we keep the file 
			// handle open. That way we avoid the cost of having to close and 
			// open it again in quick succession!
			const handle = await fs.promises.open(this.file);
			const header = new DataView(new ArrayBuffer(96));
			await handle.read(new Uint8Array(header.buffer), 0, 96, 0);
			const offset = header.getUint32(40, true);
			const size = header.getUint32(44, true);

			// Now jump to reading the index with all the entry information. 
			// Once we have that, we can close the file handle again.
			const index = new DataView(new ArrayBuffer(size));
			await handle.read(index, 0, size, offset);
			const promise = handle.close();
			this.entries = parseEntries(this, header, index);
			await promise;
			return this;
		} else if (this.fileObject) {
			const header = dataView(await this.readBytesAsync(0, 96));
			const offset = header.getUint32(40, true);
			const size = header.getUint32(44, true);
			const index = dataView(await this.readBytesAsync(offset, size));
			this.entries = parseEntries(this, header, index);
			return this;
		}
	}

	// ## save(opts)
	// Saves the DBPF to a file. Note: we're going to do this in a sync way, 
	// it's just easier.
	save(opts: string | DBPFSaveOptions = {}) {
		if (typeof opts === 'string') {
			opts = { file: opts };
		}
		const { file = this.file } = opts;
		this.header.modified = new Date();
		let buff = this.toBuffer();
		if (!file) {
			throw new TypeError('No file given to save the DBPF to!');
		}
		return fs!.writeFileSync(file, buff);
	}

	// ## toBuffer()
	// Serializes the DBPF to a *Uint8Array*. Note that this is called 
	// `.toBuffer()` for legacy purposes, but the goal is to rename it 
	// eventually to `toUint8Array()` because we are no longer requiring Node.js 
	// buffers.
	toBuffer() {

		// Generate the header buffer.
		let header = this.header.toBuffer();
		let chunks = [header];

		// Prepare a list of stuff that needs to be serialized along with its 
		// info, along with the list of compressed entries - the DIR file.
		let list: { tgi: TGI, buffer: Uint8Array }[] = [];
		let dir = new DIR();
		let major = this.header.indexMajor;
		let minor = this.header.indexMinor;

		// Now serialize all entries.
		for (let entry of this.entries) {

			// If this entry is the "DIR" entry, skip it because we're going 
			// to serialize that one ourselves.
			if (entry.type === FileType.DIR) continue;

			// If the entry was already read, it means it might have been 
			// modified, so we can't reuse the raw - potentially uncompressed - 
			// buffer in any case.
			let { tgi } = entry;
			if (entry.file || entry.buffer) {
				let buffer = entry.toBuffer();
				let size = buffer.byteLength;

				// We will only compress the entry if explicitly stored that the 
				// entry should be compressed. This means that false and 
				// undefined mean no compression.
				if (entry.compressed === true) {
					buffer = compress(buffer, { includeSize: true });
					dir.push({ tgi, size });
				}
				list.push({ tgi, buffer });
			} else {

				// If the entry has never been read, we just reuse it as is. 
				let raw = entry.raw || entry.readRaw();
				let info = getCompressionInfo(raw);
				if (info.compressed) {
					dir.push({ tgi, size: info.size });
				}
				list.push({ tgi, buffer: raw });

			}

		}

		// Ok, everything is preprocessed. Now serialize a dir entry if 
		// required.
		if (dir.length > 0) {
			let buffer = dir.toBuffer({ major, minor });
			list.push({
				tgi: new TGI(0xE86B1EEF, 0xE86B1EEF, 0x286B1F03),
				buffer,
			});
		}

		// Allright, now create all entries. We'll add them right after the 
		// header.
		let offset = header.length;
		let table = new WriteBuffer({ size: 20*list.length });
		for (let { tgi, buffer } of list) {
			chunks.push(buffer);
			table.tgi(tgi);
			table.uint32(offset);
			table.uint32(buffer.byteLength);

			// Update offsets.
			offset += buffer.byteLength;

		}

		// Now add the indexTable buffer as well & write its position & count 
		// into the header.
		let tableBuffer = table.toUint8Array();
		chunks.push(tableBuffer);
		let writer = SmartBuffer.fromBuffer(header);
		writer.writeUInt32LE(list.length, 36);
		writer.writeUInt32LE(offset, 40);
		writer.writeUInt32LE(tableBuffer.byteLength, 44);

		// Concatenate everything and report.
		return concatUint8Arrays(chunks);

	}

	// ## toJSON()
	toJSON() {
		return {
			file: this.file,
			header: this.header.toJSON(),
			entries: [...this.entries].map(entry => entry.toJSON()),
		};
	}

	// ## get exemplars()
	get exemplars() {
		return this.findAll({ type: FileType.Exemplar });
	}

	// ## readExemplars()
	// Returns a **computed** list of all exemplar entries in the dbpf.
	readExemplars() {
		return this.exemplars.map(entry => entry.read());
	}

	// ## memSearch(refs)
	// Searches all entries for a reference to the given memory address.
	memSearch(refs: uint32 | uint32[]) {
		let original = refs;
		if (!Array.isArray(refs)) {
			refs = [refs];
		}

		// Create a buffer that we'll use to convert numbers to hex.
		let out = new Array(refs.length);
		let strings = new Array(refs.length);
		let help = new Uint8Array(4);
		let view = new DataView(help.buffer);
		for (let i = 0; i < out.length; i++) {
			out[i] = [];
			let ref = refs[i];
			view.setUint32(0, ref, true);
			strings[i] = uint8ArrayToHex(help);
		}

		// Loop all entries as outer loop. This way we only have to calculate 
		// the hex string once. Speeds things up a little.
		for (let entry of this) {
			let raw = uint8ArrayToHex(entry.decompress());
			for (let i = 0; i < refs.length; i++) {
				let hex = strings[i];
				let index = raw.indexOf(hex);
				if (index > -1) {
					out[i].push({
						class: cClass[entry.type as keyof typeof cClass],
						entry,
						index,
					});
				}
			}
		}

		return !Array.isArray(original) ? out[0] : out;
		
	}

	// ## *[Symbol.iterator]
	// Allow iterating over the dbpf file by looping all it's entries.
	*[Symbol.iterator]() {
		yield* this.entries;
	}

}

// # parseEntries(header, index)
// The function that will actually parse all entries once we got the raw header 
// & index buffers.
function parseEntries(dbpf: DBPF, header: DataView, index: DataView) {
	const count = header.getUint32(36, true);
	const minor = header.getUint32(8, true);
	const locationOffset = 12 + (minor > 0 ? 4 : 0);
	const sizeOffset = locationOffset + 4;
	const rowSize = sizeOffset + 4;
	const entries = new TGIIndex<Entry>(count);
	for (let i = 0, di = 0; i < count; i++) {
		const type = index.getUint32(di, true);
		const group = index.getUint32(di+4, true);
		const instance = index.getUint32(di+8, true);
		const offset = index.getUint32(di+locationOffset, true);
		const size = index.getUint32(di+sizeOffset, true);
		const entry = new Entry({
			dbpf,
			tgi: [type, group, instance],
			offset,
			size,
		});
		entries[i] = entry;
		di += rowSize;
	}
	return entries;
}

// # dataView(arr)
// Creates a DataView over the given Uint8Array. This takes into account that 
// the Uint8Aray might be a view over the underlying arraybuffer itself.
function dataView(arr: Uint8Array) {
	return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
