// # dbpf.js
"use strict";
const fs = require('fs');
const TYPES = require('./file-types');
const Stream = require('./stream');
const crc32 = require('./crc');
const { cClass, FileType } = require('./enums');
const { decompress, compress } = require('./qfs');
const { hex, tgi } = require('./util');

// # DBPF()
// A class that represents a DBPF file. A DBPF file is basically just a custom 
// file archive format, a bit like .zip etc. as it contains other files that 
// might be compressed etc.
const DBPF = module.exports = class DBPF {

	// ## constructor(buff)
	constructor(buff) {

		// DBPF Magic number. By default this is DBPF, but we'll allow the 
		// user to change this so that a dbpf can be de-activated.
		this.id = 'DBPF';

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

		// If a buffer was specified, parse the dbpf from it.
		if (buff) {
			this.parse(buff);
		}
	}

	// ## add(tfi, file)
	// Adds a new entry to the dbpf file.
	add(tfi, file) {
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

	// ## parse(buff)
	// Decodes the DBPF file from the given buffer.
	parse(buff) {

		let rs = new Stream(buff);
		this.id = rs.string(4);
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
		const indexCount = rs.uint32();
		const indexOffset = rs.uint32();
		const indexSize = rs.uint32();
		const holesCount = rs.uint32();
		const holesOffset = rs.uint32();
		const holesSize = rs.uint32();

		// Read in the minor version of the index, for some weird reason this 
		// comes here in the header.
		index.minor = rs.uint32();
		rs.skip(4);

		// Read in all entries from the file index. It's very important that 
		// we update the length of all entries first so that the index knows 
		// how much entries it should parse!
		const entries = this.entries;
		entries.length = 0;
		entries.length = indexCount;
		rs.jump(indexOffset);
		index.parse(rs);

		return this;

	}

	// ## save(opts)
	// Saves the DBPF to a file.
	async save(opts) {
		if (typeof opts === 'string') {
			opts = {"file": opts};
		}
		this.modified = new Date();
		let buff = this.toBuffer(opts);
		return fs.promises.writeFile(opts.file, buff);
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
					buffer = compress(buffer);
					dir.push(list.length);
				}
				list.push({
					"type": entry.type,
					"group": entry.group,
					"instance": entry.instance,
					"buffer": buffer,
					"compressed": entry.compressed,
					"fileSize": fileSize,
					"compressedSize": buffer.byteLength
				});

			} else if (entry.raw) {
				if (entry.compressed) {
					dir.push(list.length);
				}
				list.push({
					"type": entry.type,
					"group": entry.group,
					"instance": entry.instance,
					"buffer": entry.raw,
					"compressed": entry.compressed,
					"fileSize": entry.fileSize,
					"compressedSize": entry.compressedSize
				});

			} else {
				throw new Error('Entry has no buffer and no file! Can\'t serialize it!');
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
				"type": 0xE86B1EEF,
				"group": 0xE86B1EEF,
				"instance": 0x286B1F03,
				"buffer": buff,
				"compressed": false,
				"fileSize": buff.byteLength,
				"compressedSize": buff.byteLength
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
				"mem": slice.readUInt32LE(8),
				"type": entry.type,
				"entry": entry,
				"index": 0
			});
			let index = size;
			buff = buff.slice(size);
			while (buff.length > 4) {
				let size = buff.readUInt32LE(0);
				let slice = buff.slice(0, size);
				let mem = slice.readUInt32LE(8);
				all.push({
					"mem": slice.readUInt32LE(8),
					"type": entry.type,
					"entry": entry,
					"index": index
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
						"class": cClass[entry.type],
						"entry": entry,
						"index": index
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
DBPF.register([
	require('./exemplar'),
	require('./lot-file'),
	require('./building-file'),
	require('./prop-file'),
	require('./item-index-file'),
	require('./base-texture-file'),
	require('./region-view-file'),
	require('./zone-developer-file'),
	require('./lot-developer-file'),
]);

// Register the different sim grids. We use the same class for multiple type 
// ids, so we need to register under id manually.
const SimGridFile = require('./sim-grid-file');
DBPF.register(FileType.SimGridFloat32, SimGridFile);
DBPF.register(FileType.SimGridUint32, SimGridFile);
DBPF.register(FileType.SimGridSint16, SimGridFile);
DBPF.register(FileType.SimGridUint16, SimGridFile);
DBPF.register(FileType.SimGridSint8, SimGridFile);
DBPF.register(FileType.SimGridUint8, SimGridFile);

// # Index
// A class that we use to index all entries in the dbpf file so that we can 
// locate them easily.
class Index {

	// ## constructor(dbpf)
	constructor(dbpf) {

		// An index is always tied to a DBPF file, so we'll have mutual 
		// references.
		Object.defineProperty(this, 'dbpf', {"value": dbpf});

		// Store the raw array of all entries. This array should always be 
		// treated by reference because it is shared with the DBPF class.
		this.entries = dbpf.entries;
		this.entriesById = Object.create(null);

		// Versioning of the index. By default we use 7.0 in SC4.
		this.major = 7;
		this.minor = 0;

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

		let entries = this.entries;
		let byId = this.entriesById;
		let length = entries.length;
		let dir = null;
		for (let i = 0; i < length; i++) {
			let entry = entries[i] = new Entry();
			entry.parse(rs, {
				"major": this.major,
				"minor": this.minor,
				"buffer": rs.buffer
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
				"major": this.major,
				"minor": this.minor
			});

			// Now find all compressed entries and update their compressed 
			// sizes so that we can store the raw buffers correctly afterwards.
			for (let id in parsed) {
				let {size} = parsed[id];
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

	// ## constructor()
	constructor() {
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
		let buff = this.raw;
		if (this.compressed) {
			buff = decompress(buff);
		}
		return buff;
	}

	// ## read()
	// Tries to convert the raw buffer of the entry into a known file type. If 
	// this fails, we'll simply return the raw buffer, but decompressed if the 
	// entry was compressed.
	read() {

		// If the entry was already read, don't read it again.
		if (this.file) {
			return this.file;
		}

		// No raw buffer stored? Unable to read the entry then.
		if (!this.raw) {
			throw new Error(
				'No raw buffer set for the entry! Hence cannot read it!'
			);
		}

		// If the entry is compressed, decompress it.
		let buff = this.decompress();

		// Now check for known file types.
		// TODO: We should change this and allow custom file types to be 
		// registered!
		let Klass = DBPF.FileTypes[this.type];
		if (!Klass) {
			return buff;
		} else {
			let file = this.file = new Klass();
			file.parse(buff, {"entry": this});
			return file;
		}

	}

	// ## get id()
	get id() {
		return tgi(this.type, this.group, this.instance);
	}

}

// Export on the DBPF class.
DBPF.Entry = Entry;

// # parseDir(dir, opts)
// Helper function for parsing the "dir" entry. Returns a json object.
function parseDir(dir, opts = {}) {
	const { major = 7, minor = 0} = opts;
	const rs = new Stream(dir.raw);
	const byteLength = major === 7 && minor === 1 ? 20 : 16;
	const n = dir.fileSize / byteLength;
	let out = Object.create(null);
	for (let i = 0; i < n; i++) {
		let type = rs.uint32();
		let group = rs.uint32();
		let instance = rs.uint32();
		let size = rs.uint32();
		if (byteLength > 16) this.skip(4);
		let id = tgi(type, group, instance);
		out[id] = {
			"type": type,
			"group": group,
			"instance": instance,
			"id": id,
			"size": size
		};
	}
	return out;
}