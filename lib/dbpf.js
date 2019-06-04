// # dbpf.js
"use strict";
const TYPES = require('./types');
const Stream = require('./stream');
const { decompress, compress } = require('./qfs');

// # DBPF()
// A class that represents a DBPF file. A DBPF file is basically just a custom 
// file archive format, a bit like .zip etc. as it contains other files that 
// might be compressed etc.
module.exports = class DBPF {

	// ## constructor(buff)
	constructor(buff) {
		this.parse(this.buffer = buff);
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

		this.created = new Date(1000*rs.uint32());
		this.modified = new Date(1000*rs.uint32());
		this.indexMajor = rs.uint32();
		this.indexCount = rs.uint32();
		this.indexOffset = rs.uint32();
		this.indexSize = rs.uint32();
		this.holesCount = rs.uint32();
		this.holesOffset = rs.uint32();
		this.holesSize = rs.uint32();
		this.indexMinor = rs.uint32();
		rs.skip(4);

		// Read all entries in the file index. While doing this, we'll check 
		// if a "dir" file exists.
		rs.jump(this.indexOffset);
		let dir = null;
		let entries = this.entries = new Array(this.indexCount);
		let index = Object.defineProperty(this, 'index', {"value": {}});
		for (let i = 0; i < entries.length; i++) {
			let type = rs.uint32();
			let group = rs.uint32();
			let instance = rs.uint32();
			if (this.indexMinor > 0) {
				rs.uint32();
			}
			let offset = rs.uint32();
			let size = rs.uint32();
			let entry = new Entry(
				this, type, group, instance, offset, size
			);
			
			// If this is the dir entry, store it.
			if (entry.type === TYPES.DIR) {
				dir = parseDir(entry, this.indexMajor, this.indexMinor);
			}

			// Store the entry.
			entries[i] = entry;
			index[entry.id] = entry;

		}

		// Parse the dir entry if it exists.
		// console.log(dir);
		if (dir) {
			for (let {id, size} of dir) {
				let entry = index[id];
				if (!entry) {
					throw new Error(`DIR contains tgi ${id}, but this was not found in the entries!`);
				}
				entry.compressed = true;
				entry.size = size;
			}
		}

	}

};

// # parseDir(dir, major, minor)
// Helper function for parsing the "dir" entry. Returns a json object.
function parseDir(dir, major, minor) {
	let buff = dir.get();
	const rs = new Stream(buff);
	const byteLength = major === 7 && minor === 1 ? 20 : 16;
	const n = dir.filesize / byteLength;
	let out = new Array(n);
	for (let i = 0; i < n; i++) {
		let type = rs.uint32();
		let group = rs.uint32();
		let instance = rs.uint32();
		let size = rs.uint32();
		if (byteLength > 16) this.skip(4);
		out[i] = {
			"type": type,
			"group": group,
			"instance": instance,
			"id": tgi(type, group, instance),
			"size": size
		};
	}
	return out;
}

// # Entry
// A class that represents a file entry in the dbpf file. We'll use this to 
class Entry {

	id = '';
	type = 0;
	typeName = '';
	group = 0;
	instance = 0;
	offset = 0;
	filesize = 0;
	size = 0;
	compressed = false;

	// ## constructor(parent, type, group, instance, offset, size)
	constructor(parent, type, group, instance, offset, size) {
		this.id = tgi(type, group, instance);
		Object.defineProperty(this, 'parent', {
			"value": parent,
			"enumerable": false,
			"configurable": false,
			"writable": false
		});
		this.type = type;
		this.typeName = TYPES[type];
		this.group = group;
		this.instance = instance;
		this.offset = offset;
		this.filesize = this.size = size;
	}

	// ## get()
	// Returns the raw contents of the entry as a buffer when given the raw 
	// array buffer of the parent dbpf file. Think of it: are we going to 
	// store the raw buffer of a dbpf file? Don't know...
	get() {
		let parent = this.parent.buffer.buffer;
		let buff = Buffer.from(parent, this.offset, this.filesize);
		if (this.compressed) {
			buff = decompress(buff);
		}
		return buff;
	}

}

// # hex(nr)
// Helper function for returning the hex representation of a number. We use 
// this function mainly for debugging purposes as most resource use the hex 
// representation for TGI's, but we simply read it in as a number.
function hex(nr) {
	return '0x'+(Number(nr).toString(16).padStart(8, '0'));
}

// # tgi(type, group, id)
// Returns a tgi id for the given type, group & id. Used for uniquely 
// identifying files.
function tgi(type, group, id) {
	return [type, group, id].map(hex).join('-');
}