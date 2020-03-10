// # lot-developer-file.js
"use strict";
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const crc32 = require('./crc');
const { FileType } = require('./enums');

// # LotDeveloperFile
module.exports = class LotDeveloperFile {

	// ## static get id()
	static get id() {
		return FileType.LotDeveloperFile;
	}

	// ## get type()
	get type() {
		return FileType.LotDeveloperFile;
	}

	// ## constructor()
	constructor() {
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0001;
		this.tileSize = 0x00000041;
		this.u1 = 0x44800000;
		this.u2 = 0x44800000;
		this.buildings = [];
		this.u3 = 0x00000000;
		this.u4 = 0x0000;
	}

	// ## parse(buff)
	parse(buff) {
		let rs = new Stream(buff);
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.tileSize = rs.dword();
		this.u1 = rs.dword();
		this.u2 = rs.dword();

		// Read in the entries.
		let count = rs.dword();
		this.buildings = new Array(count);
		for (let i = 0; i < count; i++) {
			this.buildings[i] = {
				"mem": rs.dword(),
				"type": rs.dword()
			};
		}

		// Read in the rest.
		this.u3 = rs.dword();
		this.u4 = rs.word();

		// Check if we read everything correctly.
		if (size !== rs.i) {
			console.warn([
				'Error when reading LotDeveloper Subfile!',
				`Expected ${size} bytes, but read ${rs.i}.`
			].join(' '));
		}

		return this;

	}

	// ## toBuffer()
	toBuffer() {
		return this.bgen().next().value;
	}

	// ## *bgen()
	*bgen() {

		// Pre-allocate the entire buffer.
		let buff = Buffer.allocUnsafe(36 + this.buildings.length*8);
		let ws = new WriteStream(buff);
		ws.dword(buff.byteLength);
		ws.jump(8);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.tileSize);
		ws.dword(this.u1);
		ws.dword(this.u2);
		ws.dword(this.buildings.length);
		for (let building of this.buildings) {
			ws.dword(building.mem);
			ws.dword(building.type);
		}
		ws.dword(this.u3);
		ws.word(this.u4);

		// Calculate the crc.
		buff.writeUInt32LE(this.crc = crc32(buff, 8), 4);

		yield buff;

	}

};