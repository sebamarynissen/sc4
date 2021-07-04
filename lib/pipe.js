// # pipe-tile.js
'use strict';
const { FileType } = require('./enums.js');
const Type = require('./type.js');
const Unknown = require('./unknown.js');
const { hex, chunk } = require('./util.js');
const SGProp = require('./sgprop.js');

// # Pipe
// Pipe tiles are suprisingly large data structures (usually about 700 bytes). 
// Their structure mostly corresponds to the 
class Pipe extends Type(FileType.PipeFile) {

	// ## constructor(opts)
	constructor(opts) {
		super();
		new Unknown(this);
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0003;
		this.minor = 0x0003;
		this.zot = 0x0008;
		this.unknown.byte(0x04);
		this.unknown.dword(0x00000000);
		this.appearance = 0x05;
		this.unknown.dword(0xc772bf98);
		this.zMinTract = this.xMinTract = 0x00;
		this.zMaxTract = this.xMaxTract = 0x00;
		this.xTractSize = 0x0002;
		this.zTractSize = 0x0002;
		this.sgprops = [];
		this.GID = 0x00000000;
		this.TID = 0x00000000;
		this.IID = 0x00000000;
		this.unknown.byte(0x05);
		for (let i = 0; i < 9; i++) this.unknown.float(0);
		this.xMax = 0;
		this.yMax = 0;
		this.zMax = 0;
		this.xMin = 0;
		this.yMin = 0;
		this.zMin = 0;
		this.unknown.float(0);
		this.unknown.float(0);
		this.unknown.dword(0xff000000);
		this.x = 0;
		this.y = 0;
		this.z = 0;
		this.unknown.float(0);
		this.unknown.float(1);
		this.unknown.dword(0xff000000);
		this.x2 = 0;
		this.y2 = 0;
		this.z2 = 0;
		this.unknown.float(1);
		this.unknown.float(1);
		this.x3 = 0;
		this.y3 = 0;
		this.z3 = 0;
		this.unknown.float(1);
		this.unknown.float(0);
		this.unknown.dword(0xff000000);

		// Straight piece by default. Don't set to 0x00000000 by default or 
		// you'll likely crash the game (null pointers :o)
		this.textureId = 0x000004b00;
		this.unknown.bytes([0, 0, 0, 0, 0]);
		this.orientation = 0x00;
		this.unknown.bytes([2, 0, 0]);
		this.networkType = 0x04;
		this.westConnection = 0x00;
		this.northConnection = 0x00;
		this.eastConnection = 0x00;
		this.southConnection = 0x00;
		this.unknown.bytes([0, 0, 0, 0]);
		this.xMin2 = 0;
		this.xMax2 = 0;
		this.yMin2 = 0;
		this.yMax2 = 0;
		this.zMin2 = 0;
		this.zMax2 = 0;
		this.unknown.bytes([0x10, 0x00, 0x00, 0x10]);
		for (let i = 0; i < 4; i++) this.unknown.dword(0x00000000);
		this.unknown.dword(0x00000001);
		this.unknown.dword(0x00000000);
		this.unknown.word(0x0000);
		this.unknown.float(1);
		this.blocks = 0x00000000;
		this.arrays = [[], [], [], [], []];
		this.unknown.dword(0x00000000);
		for (let i = 0; i < 3; i++) this.unknown.float(0);
		this.x4 = 0;
		for (let i = 0; i < 3; i++) this.unknown.float(0);
		this.y4 = 0;
		for (let i = 0; i < 3; i++) this.unknown.float(0);
		this.z4 = 0;
		for (let i = 0; i < 4; i++) this.unknown.float(0);
		this.unknown.dword(0x00000000);
		this.unknown.dword(0x00000000);
		this.unknown.bool(false);
		this.unknown.bool(true);
		this.unknown.bool(true);
		this.y5 = 0;
		this.y6 = 0;
		this.y7 = 0;
		this.y8 = 0;
		this.unknown.dword(0x43864ccc);
		this.subfileId = 0x49c05b9f;
		this.unknown.dword(0x00000000);
		this.unknown.dword(0x00000000);
		Object.assign(this, opts);

	}

	// ## parse(rs)
	parse(rs) {
		let size = rs.dword();
		new Unknown(this);
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		this.unknown.byte(rs.byte());
		this.unknown.dword(rs.dword());
		this.appearance = rs.byte();
		this.unknown.dword(rs.dword());
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();
		this.sgprops = rs.array(rs => new SGProp().parse(rs));
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.unknown.byte(rs.byte());
		for (let i = 0; i < 9; i++) this.unknown.float(rs.float());
		this.xMax = rs.float();
		this.yMax = rs.float();
		this.zMax = rs.float();
		this.xMin = rs.float();
		this.yMin = rs.float();
		this.zMin = rs.float();
		this.unknown.float(rs.float());
		this.unknown.float(rs.float());
		this.unknown.dword(rs.dword());
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();
		this.unknown.float(rs.float());
		this.unknown.float(rs.float());
		this.unknown.dword(rs.dword());
		this.x2 = rs.float();
		this.y2 = rs.float();
		this.z2 = rs.float();
		this.unknown.float(rs.float());
		this.unknown.float(rs.float());
		this.unknown.dword(rs.dword());
		this.x3 = rs.float();
		this.y3 = rs.float();
		this.z3 = rs.float();
		this.unknown.float(rs.float());
		this.unknown.float(rs.float());
		this.unknown.dword(rs.dword());

		// Time to read in the texture. Known values:
		//  - 0x00004b00: straight piece
		//  - 0x00000300: end piece
		//  - 0x00020700: X piece
		//  - 0x00005700: T piece
		this.textureId = rs.dword();
		this.unknown.bytes(rs.read(5));
		this.orientation = rs.byte();
		this.unknown.bytes(rs.read(3));
		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();
		this.unknown.bytes(rs.read(4));
		this.xMin2 = rs.float();
		this.xMax2 = rs.float();
		this.yMin2 = rs.float();
		this.yMax2 = rs.float();
		this.zMin2 = rs.float();
		this.zMax2 = rs.float();
		this.unknown.bytes(rs.read(4));
		for (let i = 0; i < 4; i++) this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		this.unknown.word(rs.word());
		this.unknown.float(rs.float());
		this.blocks = rs.dword();
		let arrays = this.arrays = [];
		for (let i = 0; i < 5; i++) {
			arrays.push(rs.array(rs => {
				let x = rs.float();
				let y = rs.float();
				let z = rs.float();
				let u1 = rs.float();
				let u2 = rs.float();
				let u3 = rs.dword();
				return { x, y, z, u1, u2, u3 };
			}));
		}
		this.unknown.dword(rs.dword());
		for (let i = 0; i < 3; i++) this.unknown.float(rs.float());
		this.x4 = rs.float();
		for (let i = 0; i < 3; i++) this.unknown.float(rs.float());
		this.y4 = rs.float();
		for (let i = 0; i < 3; i++) this.unknown.float(rs.float());
		this.z4 = rs.float();
		for (let i = 0; i < 4; i++) this.unknown.float(rs.float());
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		this.unknown.bool(rs.bool());
		this.unknown.bool(rs.bool());
		this.unknown.bool(rs.bool());
		this.y5 = rs.float();
		this.y6 = rs.float();
		this.y7 = rs.float();
		this.y8 = rs.float();
		this.unknown.dword(rs.dword());
		this.subfileId = rs.dword();
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());

	}

}
module.exports = Pipe;
