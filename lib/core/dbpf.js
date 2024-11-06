// # dbpf.js
import { Buffer } from 'buffer';
import { decompress, compress } from 'qfs-compression';
import * as FileClasses from './file-classes.js';
import Header from './dbpf-header.js';
import Stream from './stream.js';
import crc32 from './crc.js';
import { cClass, FileType } from './enums.js';
import fs from './fs.js';
import { hex, tgi } from 'sc4/utils';

// # DBPF()
// A class that represents a DBPF file. A DBPF file is basically just a custom 
// file archive format, a bit like .zip etc. as it contains other files that 
// might be compressed etc.
export default class DBPF {

	// ## constructor(opts)
	// Constructs the dbpf for the given file. For backwards compatibility and 
	// ease of use, a DBPF is synchronous by default, but we should support 
	// async parsing as well: that's important if we're reading in an entire 
	// plugins directory for example. Note that DBPF's are always constructed 
	// from files, **not** from buffers. As such we don't have to keep the 
	// entire buffer in memory and we can read the required parts of the file 
	// "on the fly". That's what the DBPF format was designed for!
	constructor(opts = null) {

		// If the file specified is actually a buffer, store that we don't 
		// have a file. Note that this is not recommended: we need to be able 
		// to load and unload DBPFs on the fly because we simply cannot load 
		// them all into memory!
		if (Buffer.isBuffer(opts)) {
			this.file = null;
			this.buffer = opts;
		} else if (typeof opts === 'string') {
			this.file = opts;
			this.buffer = null;
		} else {
			let { file = null, buffer = null } = opts;
			this.file = file;
			this.buffer = buffer;
		}

		// Create an empty header.
		this.header = new Header();

		// Create the index that keeps track of which entry - identified by 
		// TGI - is found where.
		this.entries = [];
		this.index = new Index(this);

		// If the user initialize the DBPF with either a file or a buffer, then 
		// parse immediately.
		if (this.buffer || this.file) {
			this.parse();
		}

	}

	// ## get length()
	get length() {
		return this.entries.length;
	}

	// ## find(fn, ...rest)
	// Proxies to entries.find()
	find(fn, ...rest) {
		if (typeof fn === 'number') {
			return this.entries.find(({ type }) => type === fn);
		} else {
			return this.entries.find(fn, ...rest);
		}
	}

	// ## add(tgi, file)
	// Adds a new entry to the dbpf file.
	add(tgi, file) {
		let entry = new Entry(this);
		entry.tgi = tgi;
		this.entries.push(entry);
		if (Buffer.isBuffer(file)) {
			entry.raw = file;
		} else if (file) {
			entry.file = file;
		}
		return entry;
	}

	// ## load()
	// If the buffer is not loaded yet, load it.
	load() {
		if (!this.buffer) {
			this.buffer = fs.readFileSync(this.file);
		}
		return this.buffer;
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
	readBytes(offset, length) {

		// If the buffer was loaded in memory, then it will be fastest to read 
		// from memory of course.
		if (this.buffer) {
			return this.buffer.subarray(offset, offset+length);
		}

		// If we don't have a buffer, but we do have a file path, then we read 
		// that specific part.
		if (this.file) {
			let buffer = Buffer.allocUnsafe(length);
			let fd = fs.openSync(this.file);
			fs.readSync(fd, buffer, 0, length, offset);
			fs.closeSync(fd);
			return buffer;
		}

		// No file or buffer set? Then we can't read.
		throw new Error(`DBPF file has no buffer, neither file set.`);

	}

	// ## parse()
	// Reads in the DBPF in a *synchronous* way. That's useful if you're 
	// testing stuff out, but for bulk reading you should use the async 
	// reading.
	parse() {

		// First of all we need to read the header, and only the header. From 
		// this we can derive where to find the index so that we can parse the 
		// entries from it.
		let header = this.header = new Header();
		header.parse(new Stream(this.readBytes(0, 96)));

		// Get how many files there are in the file index of the DBPF and set is 
		// as the length on the entries. This is important so that the index 
		// knows how many entries to parse!
		this.entries = Array(header.indexCount);

		// Header is parsed which means we now know the offset of the index. 
		// Let's parse the index as well then.
		let buffer = this.readBytes(
			this.header.indexOffset,
			this.header.indexSize,
		);
		this.index.parse(new Stream(buffer));

	}

	// ## save(opts)
	// Saves the DBPF to a file. Note: we're going to do this in a sync way, 
	// it's just easier.
	save(opts) {
		if (typeof opts === 'string') {
			opts = { file: opts };
		}
		this.modified = new Date();
		let buff = this.toBuffer(opts);
		return fs.writeFileSync(opts.file, buff);
		// return fs.promises.writeFile(opts.file, buff);
	}

	// ## toBuffer(opts)
	// Serializes the DBPF to a buffer. Note that we can't use a streamed api 
	// here because the location of the index is dependent on the size of all 
	// entries, but the location of the index is written in the header. Hence 
	// not possible.
	toBuffer(opts) {

		// Generate the header buffer.
		let header = this.header.toBuffer();
		let chunks = [header];

		// Prepare a list of stuff that needs to be serialized along with its 
		// info, along with the list of compressed entries - the DIR file.
		let list = [], dir = [];

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
			if (entry.isTouched) {
				let buffer = entry.toBuffer();
				let fileSize = buffer.byteLength;
				if (entry.compressed) {
					buffer = compress(buffer, { includeSize: true });
					dir.push(list.length);
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
				let raw = entry.readRaw();
				if (entry.compressed) {
					dir.push(list.length);
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
		if (dir.length) {

			let buff = Buffer.alloc(16 * dir.length);
			let i = 0;
			for (let index of dir) {
				let item = list[index];
				i = buff.writeUInt32LE(item.type, i);
				i = buff.writeUInt32LE(item.group, i);
				i = buff.writeUInt32LE(item.instance, i);
				i = buff.writeUInt32LE(item.fileSize, i);
			}

			list.push({
				type: 0xE86B1EEF,
				group: 0xE86B1EEF,
				instance: 0x286B1F03,
				buffer: buff,
				compressed: false,
				fileSize: buff.byteLength,
				compressedSize: buff.byteLength,
			});

		}

		// Allright, now create all entries. We'll add them right after the 
		// header.
		let offset = header.length;
		let table = Buffer.alloc(20 * list.length);
		let i = 0;
		for (let entry of list) {
			let buffer = entry.buffer;
			chunks.push(buffer);
			i = table.writeUInt32LE(entry.type, i);
			i = table.writeUInt32LE(entry.group, i);
			i = table.writeUInt32LE(entry.instance, i);
			i = table.writeUInt32LE(offset, i);
			i = table.writeUInt32LE(buffer.byteLength, i);

			// Update offsets.
			offset += buffer.byteLength;

		}

		// Now add the indexTable buffer as well & write its position & count 
		// into the header.
		chunks.push(table);
		header.writeUInt32LE(list.length, 36);
		header.writeUInt32LE(offset, 40);
		header.writeUInt32LE(table.byteLength, 44);

		// Concatenate everything and report.
		return Buffer.concat(chunks);

	}

	// ## get exemplars()
	get exemplars() {
		return this.entries.filter(entry => entry.type === FileType.Exemplar);
	}

	// ## readExemplars()
	// Returns a **computed** list of all exemplar entries in the dbpf.
	readExemplars() {
		return this.exemplars.map(entry => entry.read());
	}

	// ## recordCount()
	// Returns an object that lists how many records are counted per sub file.
	recordCount() {
		let list = [];
		for (let entry of this) {
			let buff = entry.decompress();
			let size = buff.readUInt32LE();

			// Skip the entries that don't seem to hold size crc mem records.
			if (size > buff.byteLength) {
				continue;
			}
			let slice = buff.slice(0, size);
			let crc = crc32(slice, 8);
			if (crc !== buff.readUInt32LE(4)) {
				continue;
			}

			// Okay, count records now.
			let i = 0;
			while (buff.length > 4) {
				i++;
				let size = buff.readUInt32LE(0);
				buff = buff.slice(size);
			}
			if (buff.length > 0) {
				console.log('size mismatch');
			}
			list.push([cClass[entry.type], i]);

		}
		return list;
	}

	// ## memRefs()
	// Returns a list of all records (could be sub-records) in the dbpf that 
	// use a memory reference (i.e. have general structure SIZE CRC MEM). 
	// We're using the CRC to detect if this kind of entry works this way.
	memRefs() {
		let all = [];
		for (let entry of this) {
			let buff = entry.decompress();
			let size = buff.readUInt32LE();

			// If what we're interpreting as size is larger than the buffer, 
			// it's impossible that this has the structure "SIZE CRC MEM"!
			if (size > buff.byteLength) continue;

			// Note that there may be multiple records in this buffer. We're 
			// going to parse them one by one and calculate the checksum. If 
			// the checksum matches, we're considering them to have the 
			// structure "SIZE CRC MEM".
			let slice = buff.slice(0, size);
			let crc = crc32(slice, 8);
			if (crc !== buff.readUInt32LE(4)) continue;

			// Allright, first entry is of type "SIZE MEM CRC", we assume that 
			// all following entries are as well.
			all.push({
				mem: slice.readUInt32LE(8),
				type: entry.type,
				entry,
				index: 0,
			});
			let index = size;
			buff = buff.slice(size);
			while (buff.length > 4) {
				let size = buff.readUInt32LE(0);
				let slice = buff.slice(0, size);
				let mem = slice.readUInt32LE(8);
				all.push({
					mem,
					type: entry.type,
					entry,
					index,
				});
				index += size;
				buff = buff.slice(size);
			}

		}
		return all;
	}

	// ## memSearch(refs)
	// Searches all entries for a reference to the given memory address.
	memSearch(refs) {
		let original = refs;
		if (!Array.isArray(refs)) {
			refs = [refs];
		}

		// Create a buffer that we'll use to convert numbers to hex.
		let out = new Array(refs.length);
		let strings = new Array(refs.length);
		let help = Buffer.alloc(4);
		for (let i = 0; i < out.length; i++) {
			out[i] = [];
			let ref = refs[i];
			help.writeUInt32LE(ref);
			strings[i] = help.toString('hex');
		}

		// Loop all entries as outer loop. This way we only have to calculate 
		// the hex string once. Speeds things up a little.
		for (let entry of this) {
			let raw = entry.decompress().toString('hex');
			for (let i = 0; i < refs.length; i++) {
				let hex = strings[i];
				let index = raw.indexOf(hex);
				if (index > -1) {
					out[i].push({
						class: cClass[entry.type],
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

	// ## static register([id, Klass])
	// It should be possible to register new file types on the fly so that 
	// people can write plugins for certain unknown filetypes. This can be 
	// done by calling DBPF.register(Ctor). Subsequently if entry.read() 
	// is called, the type id might be recognized and hence parsed accordingly.
	static register(arr, second) {
		if (!Array.isArray(arr)) {
			arr = [[arr, second]];
		}
		for (let entry of arr) {
			if (!Array.isArray(entry)) entry = [entry];
			let [id, Klass] = entry;
			if (!Klass) {
				Klass = id;
				id = Klass.id || Klass.prototype.id;
			}

			// Register.
			if (typeof id !== 'number') {
				throw new Error(`Trying to register a file type without numeric id!`);
			}
			DBPF.FileTypes[id] = Klass;

		}
	}

}

// The object where all **known** FileTypes reside, indexed by their id. If a 
// file type is known, this means that entry.read() won't return the buffer, but 
// will call new FileType().parse(buff, entry).
const hType = Symbol.for('sc4.type');
const FileTypes = Object.create(null);
for (let Constructor of Object.values(FileClasses)) {
	FileTypes[Constructor[hType]] = Constructor;
}
DBPF.FileTypes = FileTypes;

// # Index
// A class that we use to index all entries in the dbpf file so that we can 
// locate them easily.
class Index {

	// ## constructor(dbpf)
	constructor(dbpf) {

		// An index is always tied to a DBPF file, so we'll have mutual 
		// references.
		Object.defineProperty(this, 'dbpf', {
			value: dbpf,
			enumerable: false,
			writable: false,
		});

		// Store the raw array of all entries. This array should always be 
		// treated by reference because it is shared with the DBPF class.
		this.entriesById = Object.create(null);

		// Versioning of the index. By default we use 7.0 in SC4.
		this.major = 7;
		this.minor = 0;

	}

	// ## get entries()
	get entries() {
		return this.dbpf.entries;
	}

	// ## get(tgi)
	// Returns an entry by tgi
	get(tgi) {
		return this.entriesById[tgi] || null;
	}

	// ## parse(rs, opts)
	// Parses the index - **and all of its entries** - from a stream-wrapped 
	// buffer. Note that the stream's buffer must be the **entire** dbpf 
	// buffer! This is because an index is inherently intertwined with a DBPF.
	parse(rs, opts = {}) {

		let { dbpf, entries } = this;
		let byId = this.entriesById;
		let length = entries.length;
		let dirs = [];
		for (let i = 0; i < length; i++) {
			let entry = entries[i] = new Entry(dbpf);
			entry.parse(rs, {
				major: this.major,
				minor: this.minor,
			});
			byId[ entry.id ] = entry;

			// Check if this entry is the DIR entry. If so, store it so that 
			// we can set later whether an entry is compressed or not.
			if (entry.type === FileType.DIR) {
				dirs.push(entry);
			}

		}

		// If there was a dir entry, read it in. Then update the entries 
		// accordingly.
		for (let dir of dirs) {
			let parsed = parseDir(dir, {
				major: this.major,
				minor: this.minor,
			});

			// Now find all compressed entries and update their compressed 
			// sizes so that we can store the raw buffers correctly afterwards.
			for (let id in parsed) {
				let { size } = parsed[id];
				let entry = this.get(id);
				if (!entry) continue;
				entry.compressed = true;
				entry.fileSize = size;
			}

		}

		return this;

	}

}

// # Entry
// A class representing an entry in the DBPF file. An entry is a descriptor of 
// a file in a DBPF, but not the file itself yet. In order to actually get the 
// file, you will need to call entry.read(). If the entry is of a known type, 
// it will be parsed appropriately.
const hTypeArray = Symbol.for('sc4.type.array');
class Entry {

	// ## constructor(dbpf)
	constructor(dbpf) {
		Object.defineProperty(this, 'dbpf', {
			value: dbpf,
			enumerable: false,
			witable: false,
		});
		this.type = 0;
		this.group = 0;
		this.instance = 0;
		this.fileSize = 0;
		this.compressedSize = 0;
		this.offset = 0;
		this.compressed = false;

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
		this.raw = null;
		this.buffer = null;
		this.file = null;

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
		return !!this.raw;
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
		return DBPF.FileTypes[this.type];
	}

	// ## get isArrayType()
	// Returns whether this file type is registered as an array file type, 
	// meaning we'll automatically handle the array deserialization without the 
	// need for the file class itself to support this. Just implement a class 
	// for every item in the array.
	get isArrayType() {
		const Constructor = DBPF.FileTypes[this.type];
		return !!Constructor[hTypeArray];
	}

	// ## get isKnownType()
	// Returns whether the type of this entry is a known file type, meaning that 
	// a class has been registered for it that can properly parse the buffer.
	get isKnownType() {
		return this.type in DBPF.FileTypes;
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
		// Note: seems to be a buf in Node.js somehow, it reads in memory it 
		// is not allowed to if we use.
		// Buffer.from(buffer.buffer, offset, this.compressedSize);
		if (buffer) {

			// IMPORTANT! We need to add the source buffer's offset as well, 
			// otherwise we're reading other memory!!
			offset += buffer.offset;
			this.raw = Buffer.from(buffer.buffer, offset, this.compressedSize);
			
		}
		return this;

	}

	// ## decompress()
	// Returns the decompressed raw entry buffer. If the entry is not 
	// compressed, then the buffer is returned as is.
	decompress() {
		if (!this.raw) {
			this.raw = this.readRaw();
		}

		// Perform the decompression. Important! In Simcity 4 DBPF files, 
		// compressed subfiles are always prefixed with the total size! We can 
		// discard this.
		if (this.compressed) {
			this.buffer = decompress(this.raw.subarray(4));
		} else {
			this.buffer = this.raw;
		}
		return this.buffer;

	}

	// ## readRaw()
	// **Synchronously** reads the entry's raw buffer and stores it in the 
	// "raw" property.
	readRaw() {
		return this.dbpf.readBytes(this.offset, this.compressedSize);
	}

	// ## read()
	// Tries to convert the raw buffer of the entry into a known file type. If 
	// this fails, we'll simply return the raw buffer, but decompressed if the 
	// entry was compressed.
	read() {

		// If the entry was already read, don't read it again. Note that it's 
		// possible to dispose the entry to free up some memory if required.
		if (this.file) {
			return this.file;
		}

		// If we don't have the buffer yet, we might need to decompress the raw 
		// contents first, meaning we might have to read the raw contents first 
		// as well.
		if (!this.buffer) {
			this.decompress();
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

	}

	// ## toBuffer()
	toBuffer() {

		// If the entry has a file instance attached to it, we always construct 
		// the buffer from here. This has highest priority as it's the highest 
		// level of abstraction.
		if (this.file) {
			if (this.isArrayType) {
				let parts = [];
				for (let file of this.file) {
					parts.push(file.toBuffer());
				}
				return Buffer.concat(parts);
			} else {
				return this.file.toBuffer();
			}
		} else {
			return this.buffer;
		}

	}

	// ## [util.inspect.custom](depth, opts, inspect)
	// If we console.log an entry in node we want to convert the TGI to their 
	// hex equivalents so that it's easier to debug.
	[Symbol.for('nodejs.util.inspect.custom')](depth, opts, inspect) {
		return 'DBPF Entry '+inspect({
			type: hex(this.type),
			group: hex(this.group),
			instance: hex(this.instance),
			fileSize: this.fileSize,
			compressedSize: this.compressedSize,
			offset: this.offset,
			compressed: this.compressed,
			file: this.file,
			raw: this.raw,
		}, opts);
	}

}

// # readArrayFile()
// Reads in a subfile of the DBPF that has an array structure. Typicaly examples 
// are the lot and prop subfiles.
function readArrayFile(Constructor, buffer) {
	let i = 0;
	let array = [];
	while (i < buffer.length) {

		// Create a buffer for the specific slice, which is a *view* and 
		// not a full copy obviously, which is what buffer.slice() returns.
		let size = buffer.readUInt32LE(i);
		let slice = buffer.subarray(i, i+size);
		i += size;

		// Now parse a new child from it and push it in.
		let rs = new Stream(slice);
		let child = new Constructor();
		child.parse(rs);
		array.push(child);

	}
	return array;
}

// Export on the DBPF class.
DBPF.Entry = Entry;

// # parseDir(dir, opts)
// Helper function for parsing the "dir" entry. Returns a json object.
function parseDir(dir, opts = {}) {
	const {
		major = 7,
		minor = 0,
	} = opts;
	let { dbpf } = dir;

	// Read in the bytes for the dir.
	let size = dir.fileSize;
	let offset = dir.offset;
	let byteLength = major === 7 && minor === 1 ? 20 : 16;
	let n = size / byteLength;
	let buffer = dbpf.readBytes(offset, size);
	let rs = new Stream(buffer);

	// Now create the dir entry.
	let out = Object.create(null);
	for (let i = 0; i < n; i++) {
		let type = rs.uint32();
		let group = rs.uint32();
		let instance = rs.uint32();
		let size = rs.uint32();
		if (byteLength > 16) {
			rs.skip(4);
		}
		let id = tgi(type, group, instance);
		out[id] = {
			type,
			group,
			instance,
			id,
			size,
		};
	}
	return out;

}
