// # dbpf-entry.js
import { tgi, inspect, duplicateAsync } from 'sc4/utils';
import WriteBuffer from './write-buffer.js';
import FileType from './file-types.js';
import { decompress } from 'qfs-compression';
import { getConstructorByType, hasConstructorByType } from './filetype-map.js';
import Stream from './stream.js';
import { SmartBuffer } from 'smart-arraybuffer';

// # Entry
// A class representing an entry in the DBPF file. An entry is a descriptor of 
// a file in a DBPF, but not the file itself yet. In order to actually get the 
// file, you will need to call entry.read(). If the entry is of a known type, 
// it will be parsed appropriately.
const kTypeArray = Symbol.for('sc4.type.array');
export default class Entry {
	type = 0;
	group = 0;
	instance = 0;
	fileSize = 0;
	compressedSize = 0;
	offset = 0;
	compressed = false;

	// Below are three properties that can represent the contents of the 
	// entry:
	//  - raw: this is the raw, potentially compressed buffer, as it 
	//    was found in the DBPF. This can be null if the entry was not read 
	//    from a DBPF, but generated programmatically.
	//  - buffer: contains a buffer with the binary contents of the entry, 
	//    always uncompressed. Can again be null if it was not read from a 
	//    DBPF.
	//  - file: contains the contents of the entry in parsed form. If a 
	//    certain file type is known and a class has been implemented for 
	//    this, it can be found here. It's mainly this property that you'll 
	//    be interfacing with to modify things in a certian subfile of the 
	//    DBPF as this means you don't have to work with the raw binary data.
	raw = null;
	buffer = null;
	file = null;

	// ## constructor(opts)
	constructor(opts = {}) {
		let { dbpf, ...rest } = opts;
		Object.defineProperty(this, 'dbpf', {
			value: dbpf,
			enumerable: false,
			witable: false,
		});
		Object.assign(this, rest);
	}

	// ## get id()
	get id() {
		return tgi(this.type, this.group, this.instance);
	}

	// ## get tgi()
	get tgi() { return [this.type, this.group, this.instance]; }
	set tgi(tgi) {
		if (Array.isArray(tgi)) {
			[this.type, this.group, this.instance] = tgi;
		} else {
			this.type = tgi.type;
			this.group = tgi.group;
			this.instance = tgi.instance;
		}
	}

	// ## get isRead()
	// Returns whether the entry was read into memory. When this happened, it 
	// means that the file might have been modified and hence we can't reuse the 
	// raw - potentially uncompressed - buffer.
	get isRead() {
		return !!this.raw || !!this.buffer;
	}

	// ## get isTouched()
	// Returns whether the entry was either read, *or* we do have a decoded 
	// file. This typically happens when adding a new file to a savegame - for 
	// example a prop file. If there were no props before, then the entry should 
	// still be included in the serialization!
	get isTouched() {
		return !!this.file || this.isRead;
	}

	// ## get fileConstructor()
	// Returns the class to use for this file type, regardless of whether this 
	// is an array type or not.
	get fileConstructor() {
		return getConstructorByType(this.type);
	}

	// ## get isArrayType()
	// Returns whether this file type is registered as an array file type, 
	// meaning we'll automatically handle the array deserialization without the 
	// need for the file class itself to support this. Just implement a class 
	// for every item in the array.
	get isArrayType() {
		const Constructor = this.fileConstructor;
		return !!Constructor[kTypeArray];
	}

	// ## get isKnownType()
	// Returns whether the type of this entry is a known file type, meaning that 
	// a class has been registered for it that can properly parse the buffer.
	get isKnownType() {
		return hasConstructorByType(this.type);
	}

	// ## free()
	// Frees up the memory the entry is taking up. Useful when DBPFs get 
	// unloaded to not take up too much memory.
	free() {
		this.raw = null;
		this.file = null;
		return this;
	}

	// ## parse(rs, opts)
	// Parses the entry from the given stream-wrapper buffer.
	parse(rs, opts = {}) {
		const {
			minor = 0,
			buffer = null,
		} = opts;
		this.type = rs.uint32();
		this.group = rs.uint32();
		this.instance = rs.uint32();
		if (minor > 0) {
			rs.uint32();
		}
		let offset = this.offset = rs.uint32();
		this.compressedSize = rs.uint32();

		// Temporarilly set the fileSize to compressedSize. If the file is 
		// compressed though, we'll read this from the dir entry and update 
		// the file size accordingly. For non-compressed files, the fileSize 
		// remains ok.
		this.fileSize = this.compressedSize;

		// If a dbpf buffer was specified, extract the raw entry from it. 
		if (buffer) {
			this.raw = buffer.subarray(offset, offset+this.compressedSize);
		}
		return this;

	}

	// ## readRaw()
	// **Synchronously** reads the entry's raw buffer and stores it in the 
	// "raw" property.
	readRaw() {
		return this.dbpf.readBytes(this.offset, this.compressedSize);
	}

	// ## decompress()
	// Returns the decompressed raw entry buffer. If the entry is not 
	// compressed, then the buffer is returned as is.
	decompress() {
		return dual.decompress.sync.call(this, () => this.readRaw());
	}

	// ## read()
	// Tries to convert the raw buffer of the entry into a known file type. If 
	// this fails, we'll simply return the raw buffer, but decompressed if the 
	// entry was compressed.
	read() {
		return dual.read.sync.call(this, () => this.decompress());
	}

	// ## readRawAsync()
	// Asynchronously reads the entry's raw buffer and stores it in the raw 
	// property.
	async readRawAsync() {
		return await this.dbpf.readBytesAsync(this.offset, this.compressedSize);
	}

	// ## decompressAsync()
	// Same as decompress, but asynchronously.
	async decompressAsync() {
		return dual.decompress.async.call(this, () => this.readRawAsync());
	}

	// ## readAsync()
	// Same as read, but in an async way.
	async readAsync() {
		return dual.read.async.call(this, () => this.decompressAsync());
	}

	// ## toBuffer()
	toBuffer() {

		// If the entry has a file instance attached to it, we always construct 
		// the buffer from here. This has highest priority as it's the highest 
		// level of abstraction.
		if (this.file) {
			if (this.isArrayType) {
				let buffer = new WriteBuffer();
				for (let file of this.file) {
					buffer.writeUint8Array(file.toBuffer());
				}
				return buffer.toBuffer();
			} else {
				return this.file.toBuffer();
			}
		} else {
			return this.buffer;
		}

	}

	// ## toJSON()
	// Serializes the dbpf entry to json so that we can pass it around between 
	// threads.
	toJSON() {
		let {
			type,
			group,
			instance,
			fileSize,
			compressedSize,
			offset,
			compressed,
		} = this;
		return {
			type,
			group,
			instance,
			fileSize,
			compressedSize,
			offset,
			compressed,
		};
	}

	// ## [util.inspect.custom](depth, opts, inspect)
	// If we console.log an entry in node we want to convert the TGI to their 
	// hex equivalents so that it's easier to debug.
	[Symbol.for('nodejs.util.inspect.custom')](depth, opts, defaultInspect) {
		return 'DBPF Entry '+defaultInspect({
			dbpf: this.dbpf.file,
			type: inspect.type(FileType[this.type]) ?? inspect.hex(this.type),
			group: inspect.hex(this.group),
			instance: inspect.hex(this.instance),
			fileSize: this.fileSize,
			compressedSize: this.compressedSize,
			offset: this.offset,
			compressed: this.compressed,
			file: this.file,
			buffer: this.buffer,
			raw: this.raw,
		}, opts);
	}

}

const dual = {

	// # decompress()
	// Decompressing an entry can be done in both a sync and asynchronous way, 
	// so we use the async duplicator function.
	decompress: duplicateAsync(function*(readRaw) {

		// If we've already decompressed, just return the buffer as is.
		if (this.buffer) return this.buffer;

		// If we haven't read in the raw - potentially compressed - buffer, we 
		// have to do this first. Can be done synchronously, or asynchronously.
		if (!this.raw) {
			this.raw = yield readRaw();
		}

		// If the entry is compressed, decompress it.
		if (this.compressed) {
			this.buffer = decompress(this.raw.subarray(4));
		} else {
			this.buffer = this.raw;
		}

		return this.buffer;

	}),

	// # read()
	// Same for actually reading an entry. Can be done both sync and async.
	read: duplicateAsync(function*(decompress) {

		// If the entry was already read, don't read it again. Note that it's 
		// possible to dispose the entry to free up some memory if required.
		if (this.file) {
			return this.file;
		}

		// If we don't have the buffer yet, we might need to decompress the raw 
		// contents first, meaning we might have to read the raw contents first 
		// as well.
		if (!this.buffer) {
			yield decompress();
		}

		// If the entry does not contain a known file type, just return the 
		// buffer as is.
		if (!this.isKnownType) return this.buffer;

		// If the file type is actually an array file type, then it has been 
		// registered as [Constructor], in which case we need to read the file 
		// as an array. If nothing is found, just return the buffer. Third party 
		// code might still know how to interpret the buffer.
		const Constructor = this.fileConstructor;
		if (this.isArrayType) {
			this.file = readArrayFile(Constructor, this.buffer);
		} else {
			let file = this.file = new Constructor();
			file.parse(new Stream(this.buffer), { entry: this });
		}
		return this.file;

	}),

};

// # readArrayFile()
// Reads in a subfile of the DBPF that has an array structure. Typicaly examples 
// are the lot and prop subfiles.
function readArrayFile(Constructor, buffer) {
	let array = [];
	let rs = new Stream(buffer);
	while (rs.remaining() > 0) {

		// IMPORTANT! We read the size, but when reading the buffer to parse the 
		// entry from, we have to make sure the size is still included! It is an 
		// integral part of it!
		let size = rs.dword();
		rs.readOffset -= 4;
		let slice = rs.read(size);
		let child = new Constructor();
		child.parse(new Stream(slice));
		array.push(child);

	}
	return array;
}
