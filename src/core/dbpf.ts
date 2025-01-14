// # dbpf.js
import { compress } from 'qfs-compression';
import { concatUint8Arrays, isUint8Array, uint8ArrayToHex } from 'uint8array-extras';
import Header, { type HeaderJSON, type HeaderOptions } from './dbpf-header.js';
import Entry, { type EntryJSON, type EntryFromType } from './dbpf-entry.js';
import DIR from './dir.js';
import WriteBuffer from './write-buffer.js';
import Stream from './stream.js';
import { cClass, FileType } from './enums.js';
import { fs, TGIIndex, duplicateAsync } from 'sc4/utils';
import { SmartBuffer } from 'smart-arraybuffer';
import type { TGIArray, TGILiteral, TGIQuery, uint32 } from 'sc4/types';
import type { FindParameters } from 'src/utils/tgi-index.js';
import type { DBPFFile, DecodedFileTypeId, FileTypeId } from './types.js';

export type DBPFOptions = {
	file?: string;
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

// # DBPF()
// A class that represents a DBPF file. A DBPF file is basically just a custom 
// file archive format, a bit like .zip etc. as it contains other files that 
// might be compressed etc.
export default class DBPF {
	file: string | null = null;
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
	constructor(opts: DBPFOptions | string | Uint8Array = {}) {

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
		} else {
			let { file = null, buffer = null } = opts;
			this.file = file;
			this.buffer = buffer;
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
		let { parse = true } = opts;
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
		let entry = new Entry({ dbpf: this });
		entry.tgi = tgi;
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

		// No file or buffer set? Then we can't read.
		throw new Error(`DBPF file has no buffer, neither file set.`);

	}

	// ## readBytesAsync(offset, length)
	// Same as readBytes, but in an async way. You normally shouldn't use this 
	// for modding tasks, but we use it for reading in large plugin folders in 
	// parallel.
	async readBytesAsync(offset: number, length: number) {
		if (this.buffer) return this.buffer.subarray(offset, offset+length);
		else if (this.file) {
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
		// const dirs = fn => this.findAll({ type: FileType.DIR }).map(entry => {
		// 	fn(entry!.read());
		// });
		const dirs = (fn: DirCallback) => this.findAll({ type: FileType.DIR }).map(entry => {
			fn(entry.read());
		});
		return parse.sync.call(
			this,
			(...args: Parameters<DBPF['readBytes']>) => this.readBytes(...args),
			dirs,
		);
	}

	// ## parseAsync()
	// Same as parse, but in an async way.
	async parseAsync() {
		const dirs = async (fn: DirCallback) => await Promise.all(
			this.findAll({ type: FileType.DIR }).map(async entry => {
				fn(await entry.readAsync());
			}),
		);
		return await parse.async.call(
			this,
			(...args: Parameters<DBPF['readBytesAsync']>) => this.readBytesAsync(...args),
			dirs,
		);
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
		// return fs.promises.writeFile(opts.file, buff);
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
		let list = [];
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
			let tgi = {
				type: entry.type,
				group: entry.group,
				instance: entry.instance,
			};
			if (entry.file || entry.buffer) {
				let buffer = entry.toBuffer();
				let fileSize = buffer.byteLength;
				if (entry.compressed) {
					buffer = compress(buffer, { includeSize: true });
					dir.push({ ...tgi, size: fileSize });
				}
				list.push({
					...tgi,
					buffer,
					compressed: entry.compressed,
					fileSize,
					compressedSize: buffer.byteLength,
				});
			} else {

				// If the entry has never been read, we just reuse it as is.
				let raw = entry.raw || entry.readRaw();
				if (entry.compressed) {
					dir.push({ ...tgi, size: entry.fileSize });
				}
				list.push({
					...tgi,
					buffer: raw,
					compressed: entry.compressed,
					fileSize: entry.fileSize,
					compressedSize: entry.compressedSize,
				});

			}

		}

		// Ok, everything is preprocessed. Now serialize a dir entry if 
		// required.
		if (dir.length > 0) {
			let buffer = dir.toBuffer({ major, minor });
			list.push({
				type: 0xE86B1EEF,
				group: 0xE86B1EEF,
				instance: 0x286B1F03,
				buffer,
				compressed: false,
				fileSize: buffer.byteLength,
				compressedSize: buffer.byteLength,
			});
		}

		// Allright, now create all entries. We'll add them right after the 
		// header.
		let offset = header.length;
		let table = new WriteBuffer({ size: 20*list.length });
		for (let entry of list) {
			let buffer = entry.buffer;
			chunks.push(buffer);
			table.uint32(entry.type);
			table.uint32(entry.group);
			table.uint32(entry.instance);
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

// # parse()
// Parsing a DBPF can be done both in a sync and async way, but the underlying 
// logic is the same.
type DirCallback = (dir: DIR) => void;
const parse = duplicateAsync(function* parse(read, readDirs) {

	// First of all we need to read the header, and only the header. From 
	// this we can derive where to find the index so that we can parse the 
	// entries from it.
	let header = this.header = new Header();
	header.parse(new Stream(this.readBytes(0, 96)));

	// Header is parsed which means we now know the offset of the index. 
	// Read in the bytes of the index and then build up the index.
	let index = yield read(header.indexOffset, header.indexSize);
	fillIndex(this, index as Uint8Array);

	// We're not done yet. The last thing we need to do is read in all the 
	// DIR files to mark which entries in the DBPF are compressed.
	yield readDirs((dir: DIR) => handleDir(this, dir));
	return this;

});

// # fillIndex(dbpf, buffer)
// Reads & parses the buffer containing the file index.
function fillIndex(dbpf: DBPF, buffer: Uint8Array) {
	let rs = new Stream(buffer);
	let index = dbpf.entries = new TGIIndex(dbpf.header.indexCount);
	for (let i = 0; i < index.length; i++) {
		let entry = index[i] = new Entry({ dbpf });
		entry.parse(rs);
	}
	index.build();
}

// # handleDir(dbpf, dir)
// Handles the given dir file and marks the entries in it as compressed. 
// IMPORTANT! It's possible that a dbpf contains duplicate entries. We don't 
// really know what the spec says about this, but it doesn't seem like the DIR 
// has to be in a fixed order. Hence we'll assume that the *duplicate* entries 
// have to appear in order.
function handleDir(dbpf: DBPF, dir: DIR) {
	let counters: Record<string, number> = {};
	for (let { type, group, instance, size } of dir) {
		let entries = dbpf.findAll({ type, group, instance });
		if (entries.length === 0) continue;
		else if (entries.length === 1) {
			let [entry] = entries;
			entry.compressed = true;
			entry.fileSize = size;
		} else {

			// Only when there are multiple entries will we keep track of how 
			// often we already encountered this one!
			let [{ id }] = entries;
			let nr = counters[id] ??= 0;
			counters[id]++;
			let entry = entries[nr];
			entry.compressed = true;
			entry.fileSize = size;

		}
	}
}
