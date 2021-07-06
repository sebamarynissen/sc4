// # lot-developer-file.js
'use strict';
const Stream = require('./stream.js');
const WriteBuffer = require('sc4/lib/write-buffer.js');
const { FileType } = require('./enums.js');

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
		this.width = 0x44800000;
		this.depth = 0x44800000;
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
		this.width = rs.float();
		this.depth = rs.float();

		// Read in the entries.
		// TODO: We need to change this to reading in a pointer!
		let count = rs.dword();
		this.buildings = new Array(count);
		for (let i = 0; i < count; i++) {
			this.buildings[i] = rs.pointer();
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
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.tileSize);
		ws.float(this.width);
		ws.float(this.depth);
		ws.dword(this.buildings.length);
		for (let building of this.buildings) {
			ws.pointer(building);
		}
		ws.dword(this.u3);
		ws.word(this.u4);
		return ws.seal();
	}

};
