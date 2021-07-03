// # dbpf.js
"use strict";
const util = require('util');
const fs = require('fs');
const { EventEmitter } = require('events');
const { decompress, compress } = require('qfs-compression');
const TYPES = require('./file-types');
const Stream = require('./stream');
const crc32 = require('./crc');
const { cClass, FileType } = require('./enums');
const { hex, tgi } = require('./util');

// # DBPF()
// A class that represents a DBPF file. A DBPF file is basically just a custom 
// file archive format, a bit like .zip etc. as it contains other files that 
// might be compressed etc.
const DBPF = module.exports = class DBPF extends EventEmitter {

	// ## constructor(file)
	// Constructs the dbpf for the given file. For backwards compatibility and 
	// ease of use, a DBPF is synchronous by default, but we should support 
	// async parsing as well: that's important if we're reading in an entire 
	// plugins directory for example. Note that DBPF's are always constructed 
	// from files, **not** from buffers. As such we don't have to keep the 
	// entire buffer in memory and we can read the required parts of the file 
	// "on the fly". That's what the DBPF format was designed for!
	constructor(file = null, opts = {}) {

		// DBPF Magic number. By default this is DBPF, but we'll allow the 
		// user to change this so that a dbpf can be de-activated.
		super();
		this.id = 'DBPF';

		// If the file specified is actually a buffer, store that we don't 
		// have a file. Note that this is not recommended: we need to be able 
		// to load and unload DBPFs on the fly because we simply cannot load 
		// them all into memory!
		if (Buffer.isBuffer(file)) {
			this.file = null;
			this.buffer = file;
		} else {
			this.file = file;
			this.buffer = null;
		}

		// Versioning of DBPF. In SC4 we always use DBPF 1.0.
		this.major = 1;
		this.minor = 0;

		// Set up the initial properties of a dbpf file. As such we can use a 
		// dbpf even without parsing it. For example when creating new dbpf 
		// files.
		this.modified = this.created = new Date();

		// Create the index that keeps track of which entry - identified by 
		// TGI - is found where.
		this.entries = [];
		this.index = new Index(this);
		this.indexCount = 0;
		this.indexOffset = 0;
		this.indexSize = 0;

		// If the user specified a file, parse the DBPF right away.
		if (file) {
			this.parse();
		}

	}

	// ## find(...args)
	// Proxies to entries.find()
	find(...args) {
		return this.entries.find(...args);
	}

	// ## add(tgi, file)
	// Adds a new entry to the dbpf file.
	add(tgi, file) {
		let entry = new Entry();
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
				'This means you will no longer be able to use this DBPF!'
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

		// If we don't have a buffer, but we do have a file - which can happen 
		// if the DBPF was "unloaded" to free up memory - we'll have to load 
		// it in memory again. Note that it's your responsibility to free up 
		// memory the DBPF is taking up. You can use the `.free()` method for 
		// that.
		let buffer = this.load();
		return Buffer.from(buffer.buffer, buffer.offset+offset, length);

	}

	// ## parse()
	// Reads in the DBPF in a *synchronous* way. That's useful if you're 
	// testing stuff out, but for bulk reading you should use the async 
	// reading.
	parse() {

		// First of all we need to read the header, and only the header. From 
		// this we can derive where to find the index so that we can parse the 
		// entries from it.
		this.parseHeader(this.readBytes(0, 96));

		// Header is parsed which means we now know the offset of the index. 
		// Let's parse the index as well then.
		let buffer = this.readBytes(this.indexOffset, this.indexSize);
		let rs = new Stream(buffer);
		this.index.parse(rs);

	}

	// ## parseHeader(buff)
	// Parses the header of the DBPF file from the given buffer.
	parseHeader(buff) {

		let rs = new Stream(buff);
		this.id = rs.string(4);
		if (this.id !== 'DBPF') {
			throw new Error(`${ this.file } is not a valid DBPF file!`);
		}
		this.major = rs.uint32();
		this.minor = rs.uint32();

		// 12 unknown bytes.
		rs.skip(12);

		// Read in creation & modification date.
		this.created = new Date(1000*rs.uint32());
		this.modified = new Date(1000*rs.uint32());

		// Update the major version of the index used.
		const index = this.index;
		index.major = rs.uint32();

		// Read in where we can find the file index and the holes. Note that 
		// this is specific to the serialization of a dbpf, we only need this 
		// when parsing so we won't store these values on the dbpf itself.
		const indexCount = this.indexCount = rs.uint32();
		const indexOffset = this.indexOffset = rs.uint32();
		const indexSize = this.indexSize = rs.uint32();
		const holesCount = rs.uint32();
		const holesOffset = rs.uint32();
		const holesSize = rs.uint32();

		// Read in the minor version of the index, for some weird reason this 
		// comes here in the header.
		index.minor = rs.uint32();

		// Read in all entries from the file index. It's very important that 
		// we update the length of all entries first so that the index knows 
		// how much entries it should parse!
		const entries = this.entries = [];
		entries.length = this.indexCount;

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
		let header = Buffer.alloc(96);
		let chunks = [header];
		header.write(this.id, 0);
		header.writeUInt32LE(this.major, 4);
		header.writeUInt32LE(this.minor, 8);

		// Write away the creation & modification date.
		header.writeUInt32LE(this.created.getTime()/1000, 24);
		header.writeUInt32LE(this.modified.getTime()/1000, 28);

		// Write away the index major & minor version.
		let index = this.index;
		header.writeUInt32LE(index.major, 32);
		header.writeUInt32LE(index.minor, 88);

		// Prepare a list of stuff that needs to be serialized along with its 
		// info.
		let list = [];

		// Prepare the list of compressed entries. We'll need this for our dir 
		// entry.
		let dir = [];

		// Now serialize all entries.
		for (let entry of this.entries) {

			// If this entry is the "DIR" entry, skip it because we're going 
			// to serialize that one ourselves.
			if (entry.type === TYPES.DIR) continue;

			// Check if the entry has a "file" asociated with it. If not, we 
			// can simply use the entry's raw buffer "as is". Note that if the 
			// entry has no "file" set, this doesn't mean that the file type 
			// is unknown! It's simply possible that the entry was never read! 
			if (entry.file) {

				let {file} = entry;
				let buffer = file.toBuffer(opts);
				let fileSize = buffer.byteLength;
				if (entry.compressed) {
					buffer = compress(buffer, { includeSize: true });
					dir.push(list.length);
				}
				list.push({
					type: entry.type,
					group: entry.group,
					instance: entry.instance,
					buffer: buffer,
					compressed: entry.compressed,
					fileSize: fileSize,
					compressedSize: buffer.byteLength
				});

			} else {

				// Allright, the entry has not been decoded into a file yet. 
				// Check if has even been read. If not the case we will need 
				// to do this first.
				if (!entry.raw) {
					entry.readRaw();
				}

				if (entry.compressed) {
					dir.push(list.length);
				}
				list.push({
					type: entry.type,
					group: entry.group,
					instance: entry.instance,
					buffer: entry.raw,
					compressed: entry.compressed,
					fileSize: entry.fileSize,
					compressedSize: entry.compressedSize
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
				compressedSize: buff.byteLength
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
		return this.entries.filter(entry => entry.type === TYPES.Exemplar);
	}

	// ## readExemplars()
	// Returns a **computed** list of all exemplar entries in the dbpf.
	readExemplars() {
		return this.exemplars.map(entry => entry.read());
	}

	// ## recordCount()
	// Returns an object that lists how many records are counted per sub file.
	recordCount() {
		let list = []
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
				entry: entry,
				index: 0
			});
			let index = size;
			buff = buff.slice(size);
			while (buff.length > 4) {
				let size = buff.readUInt32LE(0);
				let slice = buff.slice(0, size);
				let mem = slice.readUInt32LE(8);
				all.push({
					mem: slice.readUInt32LE(8),
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
	static register(arr) {
		if (!Array.isArray(arr)) arr = [[].slice.call(arguments)];
		for (let entry of arr) {
			if (!Array.isArray(entry)) entry = [entry];
			let [id, Klass] = entry;
			if (!Klass) {
				Klass = id;
				id = Klass.id || Klass.prototype.id;
			}

			// Register.
			DBPF.FileTypes[ id ] = Klass;

		}
	}

};

// The object where all **known** FileTypes reside. If a file type is known, 
// this means that entry.read() won't return the buffer, but will call new 
// FileType().parse(buff, entry).
DBPF.FileTypes = Object.create(null);

// Register our known filetypes. For now only Exemplars and LotFiles. More 
// might be added.
const Exemplar = require('./exemplar.js');
DBPF.register([
	Exemplar,
	require('./lot').Array,
	require('./building').Array,
	require('./prop').Array,
	require('./flora').Array,
	require('./lot-base-texture').Array,
	require('./network').Array,
	require('./item-index'),
	require('./region-view'),
	require('./zone-developer-file'),
	require('./lot-developer-file'),
	require('./com-serializer-file'),
	require('./zone-manager.js'),
	require('./tract-developer.js'),
	require('./line-item.js').Array,
	require('./department-budget.js').Array,
]);
DBPF.register(FileType.Cohort, Exemplar);

// Register the different sim grids. We use the same class for multiple type 
// ids, so we need to register under id manually.
const SimGridFile = require('./sim-grid-file');
DBPF.register(FileType.SimGridFloat32, SimGridFile);
DBPF.register(FileType.SimGridUint32, SimGridFile);
DBPF.register(FileType.SimGridSint16, SimGridFile);
DBPF.register(FileType.SimGridUint16, SimGridFile);
DBPF.register(FileType.SimGridSint8, SimGridFile);
DBPF.register(FileType.SimGridUint8, SimGridFile);

// Register the terrain as well.
DBPF.register(FileType.TerrainMap, require('./terrain-map.js'));

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
		let dir = null;
		for (let i = 0; i < length; i++) {
			let entry = entries[i] = new Entry(dbpf);
			entry.parse(rs, {
				major: this.major,
				minor: this.minor,
			});
			byId[ entry.id ] = entry;

			// Check if this entry is the DIR entry. If so, store it so that 
			// we can set later whether an entry is compressed or not.
			if (entry.type === TYPES.DIR) {
				dir = entry;
			}

		}

		// If there was a dir entry, read it in. Then update the entries 
		// accordingly.
		if (dir) {
			let parsed = parseDir(dir, {
				major: this.major,
				minor: this.minor
			});

			// Now find all compressed entries and update their compressed 
			// sizes so that we can store the raw buffers correctly afterwards.
			for (let id in parsed) {
				let { size } = parsed[id];
				let entry = this.get(id);
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
class Entry {

	// ## constructor(dbpf)
	constructor(dbpf) {
		Object.defineProperty(this, 'dbpf',{
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

		// The "raw" property will store the raw buffer of an entry if the 
		// file was fetched from somewhere. If the entry corresponds to a 
		// known file type, then the parsed file type will be set in the file 
		// property. In that case you shouldn't use the raw buffer anymore. 
		// Use the file property to make modifications.
		this.raw = null;
		this.file = null;

	}

	// ## free()
	// Frees up the memory the entry is taking up. Useful when DBPFs get 
	// unloaded to not take up too much memory.
	free() {
		this.raw = null;
		this.file = null;
		return this;
	}

	// ## get tgi()
	get tgi() { return [ this.type, this.group, this.instance ]; }
	set tgi(tgi) {
		if (Array.isArray(tgi)) {
			[this.type, this.group, this.instance] = tgi;
		} else {
			this.type = tgi.type;
			this.group = tgi.group;
			this.instance = tgi.instance;
		}
	}

	// ## parse(rs, opts)
	// Parses the entry from the given stream-wrapper buffer.
	parse(rs, opts = {}) {
		const {
			minor = 0,
			major = 7,
			buffer = null
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
			this.readRaw();
		}
		let buff = this.raw;
		if (this.compressed) {

			// Important! In Simcity 4 DBPF files, compressed subfiles are 
			// always prefixed with the total size! We can discard this.
			buff = decompress(buff.slice(4));

		}
		return buff;
	}

	// ## readRaw()
	// **Synchronously** reads the entry's raw buffer and stores it in the 
	// "raw" property.
	readRaw() {

		// Find the raw entry buffer inside the DBPF file. We'll do this in a 
		// sync way, but we should support doing this asynchronously as well.
		this.raw = this.dbpf.readBytes(this.offset, this.compressedSize);

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

		// Before reading the entry, we'll emit an event on the owning DBPF. 
		// As such a cache can keep track of which DBPF files are read from 
		// most often.
		this.dbpf.emit('read');

		// If the entry is compressed, decompress it.
		this.readRaw();
		let buff = this.decompress();

		// Now check for known file types.
		// TODO: We should change this and allow custom file types to be 
		// registered!
		let Klass = DBPF.FileTypes[this.type];
		if (!Klass) {
			return buff;
		} else {
			let file = this.file = new Klass();
			file.parse(buff, { entry: this });
			return file;
		}

	}

	// ## get id()
	get id() {
		return tgi(this.type, this.group, this.instance);
	}

	// ## [util.inspect.custom]()
	// If we console.log an entry in node we want to convert the TGI to their 
	// hex equivalents so that it's easier to debug.
	[util.inspect.custom]() {
		return {
			type: hex(this.type),
			group: hex(this.group),
			instance: hex(this.instance),
			fileSize: this.fileSize,
			compressedSize: this.compressedSize,
			offset: this.offset,
			compressed: this.compressed,
			file: String(this.file),
			raw: this.raw ? '[Object Buffer]' : null,
		};
	}

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
