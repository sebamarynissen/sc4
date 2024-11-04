// # building-file.js
'use strict';
const WriteBuffer = require('./write-buffer.js');
const FileType = require('./file-types.js');
const SGProp = require('./sgprop.js');

// # Building()
// Represents a single building from the building file.
class Building {

	static [Symbol.for('sc4.type')] = FileType.BuildingFile;
	static [Symbol.for('sc4.type.array')] = true;

	// ## constructor(opts)
	constructor(opts) {
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
		this.unknown2 = 0x00;
		this.IID1 = this.IID = this.TID = this.GID = 0x00000000;
		this.minZ = this.minY = this.minX = 0;
		this.maxZ = this.maxY = this.maxX = 0;
		this.orientation = 0x00;
		this.scaffold = 0x01;
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
		dz = dz || 0;
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

		// There seems to be an error in the Wiki. The unknown byte should 
		// come **after** the IID1, otherwise they're incorrect.
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.IID1 = rs.dword();
		this.unknown2 = rs.byte();
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
				`Size is ${size}, but only read ${diff} bytes!`,
			].join(' '));
		}

		return this;

	}

	// # toBuffer()
	// Creates a buffer for the building.
	toBuffer() {

		let ws = new WriteBuffer();
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
		ws.array(this.sgprops);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.dword(this.IID1);
		ws.byte(this.unknown2);
		ws.float(this.minX);
		ws.float(this.minY);
		ws.float(this.minZ);
		ws.float(this.maxX);
		ws.float(this.maxY);
		ws.float(this.maxZ);
		ws.byte(this.orientation);
		ws.float(this.scaffold);

		// We're done. Seal the buffer and update our crc.
		let out = ws.seal();
		this.crc = +ws;
		return out;

	}

};
module.exports = Building;
