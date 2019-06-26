// # base-texture-file.js
"use strict";
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const { FileType } = require('./enums');
const crc32 = require('./crc');

// # BaseTextureFile
class BaseTextureFile {

	// ## get id()
	static get id() { return FileType.BaseTextureFile; }

	// ## constructor()
	constructor() {
		this.textures = [];
	}

	// ## parse(buff)
	parse(buff) {
		let rs = new Stream(buff);
		while (!rs.eof()) {
			let texture = new LotBaseTexture();
			this.textures.push(texture);
			texture.parse(rs);
		}

		return this;

	}

	// ## *[Symbol.iterator]
	*[Symbol.iterator]() {
		yield* this.textures;
	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen()));
	}

	// ## *bgen(opts)
	*bgen(opts) {
		for (let texture of this.textures) {
			yield* texture.bgen(opts);
		}
	}

}
module.exports = BaseTextureFile;

// # LotBaseTexture
class LotBaseTexture {

	// ## constructor()
	constructor() {
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0002;
		this.minor = 0x0004;
		this.u1 = 0x00;
		this.u2 = 0x00;
		this.u3 = 0x00;
		this.u4 = 0x00;
		this.u5 = 0x00000000;
		this.xMinTract = 0x40;
		this.zMinTract = 0x40;
		this.xMaxTract = 0x40;
		this.zMaxTract = 0x40;
		this.xTractSize = 0x0002;
		this.zTractSize = 0x0002;
		this.u6 = 0x00000000;
		this.u7 = 0x00000000;
		this.u8 = 0x00000000;
		this.u9 = 0x00000000;
		this.zMin = this.yMin = this.xMin = 0;
		this.zMax = this.yMax = this.xMax = 0;
		this.u10 = 0x02;
		this.textures = [];
	}

	// ## parse(rs)
	parse(rs) {

		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.u1 = rs.byte();
		this.u2 = rs.byte();
		this.u3 = rs.byte();
		this.u4 = rs.byte();
		this.u5 = rs.dword();
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();
		this.u6 = rs.dword();
		this.u7 = rs.dword();
		this.u8 = rs.dword();
		this.u9 = rs.dword();
		this.xMin = rs.float();
		this.yMin = rs.float();
		this.zMin = rs.float();
		this.xMax = rs.float();
		this.yMax = rs.float();
		this.zMax = rs.float();
		this.u10 = rs.byte();

		// Now read the tiles.
		let count = rs.dword();
		this.textures.length = count;
		for (let i = 0; i < count; i++) {
			let texture = this.textures[i] = new Texture();
			texture.parse(rs);
		}

		// Check that we've read everything.
		let diff = rs.i - start;
		if (diff !== size) {
			console.warn(`Size was ${size}, but read ${diff} bytes!`);
			rs.jump(start + size);
		}

	}

	// ## tobuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

	// ## *bgen(opts)
	*bgen(opts) {

		// Create a buffer for the first static part.
		let one = Buffer.allocUnsafe(77);
		let ws = new WriteStream(one);

		// Start writing everything away.
		ws.jump(8);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.byte(this.u1);
		ws.byte(this.u2);
		ws.byte(this.u3);
		ws.byte(this.u4);
		ws.dword(this.u5);
		ws.byte(this.xMinTract);
		ws.byte(this.zMinTract);
		ws.byte(this.xMaxTract);
		ws.byte(this.zMaxTract);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		ws.dword(this.u6);
		ws.dword(this.u7);
		ws.dword(this.u8);
		ws.dword(this.u9);
		ws.float(this.xMin);
		ws.float(this.yMin);
		ws.float(this.zMin);
		ws.float(this.xMax);
		ws.float(this.yMax);
		ws.float(this.zMax);
		ws.byte(this.u10);
		ws.dword(this.textures.length);

		// Now serialize the textures individually as well.
		let textures = this.textures.map(tx => tx.toBuffer());

		// Concatenate everything together and add size & crc.
		let out = Buffer.concat([one, ...textures]);
		out.writeUInt32LE(out.byteLength, 0);
		out.writeUInt32LE(crc32(out, 8), 4);
		yield out;

	}

}

// # Texture
class Texture {

	// ## constructor()
	constructor() {
		this.IID = 0x00000000;
		this.z = this.x = 0;
		this.orientation = 0;
		this.u1 = 0x00;
		this.u2 = 0x00;
		this.u3 = 0x00;
		this.u4 = 0x00;
		this.u5 = 0x00;
		this.u6 = 0x00;
		this.u7 = 0x00;
	}

	// ## parse(rs)
	parse(rs) {
		this.IID = rs.dword();
		this.x = rs.byte();
		this.z = rs.byte();
		this.orientation = rs.byte();
		this.u1 = rs.byte();
		this.u2 = rs.byte();
		this.u3 = rs.byte();
		this.u4 = rs.byte();
		this.u5 = rs.byte();
		this.u6 = rs.byte();
		this.u7 = rs.byte();
		return this;
	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

	// ## *bgen()
	*bgen() {
		let buff = Buffer.allocUnsafe(14);
		let ws = new WriteStream(buff);
		ws.dword(this.IID);
		ws.byte(this.x);
		ws.byte(this.z);
		ws.byte(this.orientation);
		ws.byte(this.u1);
		ws.byte(this.u2);
		ws.byte(this.u3);
		ws.byte(this.u4);
		ws.byte(this.u5);
		ws.byte(this.u6);
		ws.byte(this.u7);
		yield buff;
	}

}