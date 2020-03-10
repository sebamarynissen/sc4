// # zone-developer-file.js
"use strict";
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const crc32 = require('./crc');
const { FileType } = require('./enums');

// # ZoneDeveloperFile
class ZoneDeveloperFile {

	// ## get id()
	static get id() {
		return FileType.ZoneDeveloperFile;
	}

	// ## get type()
	get type() {
		return FileType.ZoneDeveloperFile;
	}

	// ## constructor()
	constructor() {
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0001;
		this.xSize = 0x00000040;
		this.zSize = 0x00000040;
		this.cells = [];
	}

	// ## parse(buff, opts)
	parse(buff, opts) {

		let rs = new Stream(buff);
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.xSize = rs.dword();
		this.zSize = rs.dword();

		// Read in the cell values. Note that we read data downwards, so first 
		// [0,0], then [0,1], then [0, 2], ... The cells should reflect this!
		let cells = this.cells = new Array(this.xSize);
		for (let x = 0; x < this.xSize; x++) {
			let column = cells[x] = new Array(this.zSize);
			for (let z = 0; z < this.zSize; z++) {
				let mem = rs.dword();
				if (mem !== 0x00000000) {
					let type = rs.dword();
					column[z] = {
						"mem": mem,
						"type": type
					};
				}
			}
		}

		if (rs.i !== size) {
			console.warn([
				'Error when reading the ZoneDeveloperFile!'
				`Expected ${size} bytes, but read ${rs.i}!`
			].join(' '));
		}

		// Done.
		return this;

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

	// ## *bgen(opts)
	*bgen() {

		// Pre-allocate the entire buffer. We have a header of 22 bytes and 
		// then we have to count the non-zero entries.
		let size = 22 + 4*(this.xSize * this.zSize);
		for (let cell of this) {
			if (cell) size += 4;
		}
		let buff = Buffer.allocUnsafe(size);

		// Create a writable stream and start writing.
		let ws = new WriteStream(buff);
		ws.dword(size);
		ws.jump(8);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.xSize);
		ws.dword(this.zSize);
		for (let cell of this) {
			if (!cell) {
				ws.dword(0x00000000);
			} else {
				ws.dword(cell.mem);
				ws.dword(cell.type);
			}
		}

		// Calculate the crc & yield.
		buff.writeUInt32LE(this.crc = crc32(buff, 8), 4);

		yield buff;

	}

	// ## *[Symbol.iterator]
	// Allows the file to be used as iterator. We'll yield all cells in 
	// z-order first.
	*[Symbol.iterator]() {
		let cells = this.cells;
		for (let x = 0; x < this.xSize; x++) {
			for (let z = 0; z < this.zSize; z++) {
				yield cells[x][z];
			}
		}
	}

}
module.exports = ZoneDeveloperFile;