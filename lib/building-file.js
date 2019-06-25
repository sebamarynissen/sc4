// # building-file.js
"use strict";
const Stream = require('./stream');
const crc32 = require('./crc');
const FileType = require('./file-types');
const SGProp = require('./sgprop');
const { hex } = require('./util');

// # BuildingFile
class BuildingFile {

	static get id() {
		return FileType.BuildingFile;
	}

	// ## constructor()
	constructor() {
		this.buildings = [];
	}

	// ## parse(buff, opts)
	parse(buff, opts) {
		let buildings = this.buildings;
		buildings.length = 0;

		// Read all buildings.
		let rs = new Stream(buff);
		while (!rs.eof()) {
			let building = new Building();
			building.parse(rs);
			buildings.push(building);
		}

		return this;

	}

	// ## *bgen(opts)
	*bgen(opts) {
		for (let building of this.buildings) {
			yield* building.bgen(opts);
		}
	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen()));
	}

	// ## *[Symbol.iterator]
	*[Symbol.iterator]() {
		yield* this.buildings;
	}

}
module.exports = BuildingFile;

// # Building()
// Represents a single building from the building file.
class Building {

	// ## constructor()
	constructor() {
		this.crc = 0x00000000;
		this.mem = 0;
		this.major = 0x0002;
		this.minor = 0x0004;
		this.zotWord = 0x0;
		this.unknown1 = 0x00;
		this.appearance = 0x00;
		this.minTractX = 0x00;
		this.minTractZ = 0x00;
		this.maxTractX = 0x00;
		this.maxTractZ = 0x00;
		this.xTractSize = 0x0002;
		this.zTractSize = 0x0002;
		this.sgprops = [];
		this.unknown2 = 0x01;
		this.IID1 = this.IID = this.TID = this.GID = 0x00000000;
		this.minZ = this.minY = this.minX = 0;
		this.maxZ = this.maxY = this.maxX = 0;
		this.orientation = 0x00;
		this.scaffold = 0;
	}

	// ## parse(rs)
	// Parses the building from a buffer wrapper up in a readable stream.
	parse(rs) {

		let start = rs.i;
		let size = rs.dword();

		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zotWord = rs.word();
		this.unknown1 = rs.byte();
		this.appearance = rs.byte();

		// 0x278128A0, always the same.
		rs.dword();

		this.minTractX = rs.byte();
		this.minTractZ = rs.byte();
		this.maxTractX = rs.byte();
		this.maxTractZ = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();

		// Read the SGProps.
		const count = rs.dword();
		const props = this.sgprops;
		props.length = count;
		for (let i = 0; i < count; i++) {
			let prop = props[i] = new SGProp();
			prop.parse(rs);
		}

		this.unknown2 = rs.byte();
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.IID1 = rs.dword();
		this.minX = rs.float();
		this.minY = rs.float();
		this.minZ = rs.float();
		this.maxX = rs.float();
		this.maxY = rs.float();
		this.maxZ = rs.float();
		this.orientation = rs.byte();
		this.scaffold = rs.float();

		// Make sure the entry was read correctly.
		let diff = rs.i - start;
		if (diff !== size) {
			throw new Error([
				'Error while reading the entry!', 
				`Size is ${size}, but only read ${diff} bytes!`
			].join(' '));
		}

		return this;

	}

	// ## *bgen(opts)
	*bgen() {

		// Create a buffer for the fixed size part until the sgprops follow.
		let one = Buffer.allocUnsafe(36);

		// Size and checksum follow later on, so i starts at 8.
		let i = 8;
		i = one.writeUInt32LE(this.mem, i);
		i = one.writeUInt16LE(this.major, i);
		i = one.writeUInt16LE(this.minor, i);
		i = one.writeUInt16LE(this.zotWord, i);
		i = one.writeUInt8(this.unknown1, i);
		i = one.writeUInt8(this.appearance, i);
		i = one.writeUInt32LE(0x278128A0, i);
		i = one.writeUInt8(this.minTractX, i);
		i = one.writeUInt8(this.minTractZ, i);
		i = one.writeUInt8(this.maxTractX, i);
		i = one.writeUInt8(this.maxTractZ, i);
		i = one.writeUInt16LE(this.xTractSize, i);
		i = one.writeUInt16LE(this.zTractSize, i);
		i = one.writeUInt32LE(this.sgprops.length, i);

		// Now serialize all our sgprops.
		let props = this.sgprops.map(prop => prop.toBuffer());

		// Serialize the fixed remainder.
		let two = Buffer.allocUnsafe(46);
		i = two.writeUInt8(this.unknown2, 0);
		i = two.writeUInt32LE(this.GID, i);
		i = two.writeUInt32LE(this.TID, i);
		i = two.writeUInt32LE(this.IID, i);
		i = two.writeUInt32LE(this.IID1, i);
		i = two.writeFloatLE(this.minX, i);
		i = two.writeFloatLE(this.minY, i);
		i = two.writeFloatLE(this.minZ, i);
		i = two.writeFloatLE(this.maxX, i);
		i = two.writeFloatLE(this.maxY, i);
		i = two.writeFloatLE(this.maxZ, i);
		i = two.writeUInt8(this.orientation, i);
		i = two.writeFloatLE(this.scaffold, i);

		// Concatenate.
		let out = Buffer.concat([one, ...props, two]);

		// Set size & calculate crc.
		out.writeUInt32LE(out.byteLength, 0);
		out.writeUInt32LE(this.crc = crc32(out, 8), 4);

		// Done, yield the buffer.
		yield out;

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

}