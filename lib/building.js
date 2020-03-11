// # building-file.js
"use strict";
const deprecate = require('util-deprecate');
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const crc32 = require('./crc');
const FileType = require('./file-types');
const SGProp = require('./sgprop');
const Type = require('./type');

// # Building()
// Represents a single building from the building file.
const Building = class Building extends Type(FileType.BuildingFile) {

	// ## constructor(opts)
	constructor(opts) {
		super();
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0002;
		this.minor = 0x0004;
		this.zotWord = 0x0;
		this.unknown1 = 0x00;
		this.appearance = 0b00000101;
		this.xMinTract = 0x00;
		this.zMinTract = 0x00;
		this.xMaxTract = 0x00;
		this.zMaxTract = 0x00;
		this.xTractSize = 0x0002;
		this.zTractSize = 0x0002;
		this.sgprops = [];
		this.unknown2 = 0x01;
		this.IID1 = this.IID = this.TID = this.GID = 0x00000000;
		this.minZ = this.minY = this.minX = 0;
		this.maxZ = this.maxY = this.maxX = 0;
		this.orientation = 0x00;
		this.scaffold = 0;
		Object.assign(this, opts);
	}

	// ## move(dx, dy, dz)
	// The move vector of the building contains [dx, dy, dz] and should be 
	// given in meters! This is because apparently the min/max values of the 
	// building are given in meters as well.
	move(dx, dy, dz) {
		if (Array.isArray(dx)) {
			[dx, dy, dz] = dx;
		}
		dx = dx || 0;
		dy = dy || 0;
		dz = dz || 0.
		this.minX += dx;
		this.maxX += dx;
		this.minY += dy;
		this.maxY += dy;
		this.minZ += dz;
		this.maxZ += dz;

		// Recalculate the tracts. A tract is a 4x4 tile, so 4x16m in length.
		this.xMinTract = 0x40 + Math.floor(this.minX / 64);
		this.xMaxTract = 0x40 + Math.floor(this.maxX / 64);
		this.zMinTract = 0x40 + Math.floor(this.minZ / 64);
		this.zMaxTract = 0x40 + Math.floor(this.maxZ / 64);

		// Return.
		return this;

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

		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
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
		// let i = 8;
		let ws = new WriteStream(one);
		ws.jump(8);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zotWord);
		ws.byte(this.unknown1);
		ws.byte(this.appearance);
		ws.dword(0x278128A0);
		ws.byte(this.xMinTract);
		ws.byte(this.zMinTract);
		ws.byte(this.xMaxTract);
		ws.byte(this.zMaxTract);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		ws.dword(this.sgprops.length);

		// Now serialize all our sgprops.
		let props = this.sgprops.map(prop => prop.toBuffer());

		// Serialize the fixed remainder.
		let two = Buffer.allocUnsafe(46);
		ws = new WriteStream(two);
		ws.byte(this.unknown2);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.dword(this.IID1);
		ws.float(this.minX);
		ws.float(this.minY);
		ws.float(this.minZ);
		ws.float(this.maxX);
		ws.float(this.maxY);
		ws.float(this.maxZ);
		ws.byte(this.orientation);
		ws.float(this.scaffold);

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
module.exports = Building;

// Deprecate .buildings.
Object.defineProperty(Building.Array.prototype, 'buildings', {
	"get": deprecate(function() {
		return this;
	}, '.buildings is deprecated, use as normal array instead')
});