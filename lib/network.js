// # network.js
"use strict";
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const crc32 = require('./crc');
const SGProp = require('./sgprop');
const Type = require('./type');
const { hex } = require('./util');
const { FileType } = require('./enums');

// # Network
// A class for representing a single network tile.
class Network extends Type(FileType.NetworkFile) {

	// ## constructor()
	constructor() {
		super();
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0002;
		this.minor = 0x0003;
		this.zot = 0x0000;

		// According to the wiki there are still a lot of unknowns. We'll be 
		// storing them in an array as this works a bit easier to loop them 
		// etc. Note that this means we begin from 0 though!
		let u = this.u = [];
		u[0] = 0x00;

		this.appearance = 0x05;
		u[1] = 0xc772bf98;
		this.zMinTract = this.xMinTract = 0x00;
		this.zMaxTract = this.xMaxTract = 0x00;
		this.xTractSize = 0x0002;
		this.zTractSize = 0x0002;
		this.sgprops = [];
		this.GID = 0x00000000;
		this.TID = 0x00000000;
		this.IID = 0x00000000;
		u[2] = 0x00;
		this.zMax = this.yMax = this.xMax = 0;
		this.zMin = this.yMin = this.xMin = 0;
		u[3] = 0;
		u[4] = 0;
		u[5] = 0xffdddbde;
		this.z = this.y = this.x = 0;
		u[6] = 0;
		u[7] = 1;

		// Don't know why, but x y z seems to be repeated for a reason, but 
		// the values are different.
		u[8] = 0xffdddbde;
		this.z2 = this.y2 = this.x2 = 0;

		u[9] = 1;
		u[10] = 1;
		u[11] = 0xffdddbde;
		this.z3 = this.y3 = this.x3 = 0;

		u[12] = 1;
		u[13] = 0;
		u[14] = 0xffdddbde;

		this.textureId = 0x00000000;

		// 5x unknown byte. Using the most common values here as defaults.
		u[15] = 0x01;
		u[16] = 0x00;
		u[17] = 0x00;
		u[18] = 0x20;
		u[19] = 0x08;

		this.orientation = 0x00;

		// More unknown bytes.
		u[20] = 0x02;
		u[21] = 0x00;

		// Apparently there's some kind of count of 5 bytes here. The wiki as 
		// well as SGE don't take this into account correctly, but it has to 
		// be taken into account, otherwise the size doesn't match.
		this.unknownReps = [];

		this.networkType = 0x00;
		this.westConnection = 0x00;
		this.northConnection = 0x00;
		this.eastConnection = 0x00;
		this.southConnection = 0x00;

		// More unknown bytes.
		u[23] = u[24] = u[25] = u[26] = 0x00;

		this.xMax2 = this.xMin2 = 0;
		this.yMax2 = this.yMin2 = 0;
		this.zMax2 = this.zMin2 = 0;

		// More unknown bytes.
		u[27] = 0x08;
		u[28] = 0xa0;
		u[29] = 0x00;
		u[30] = 0x16;
		u[31] = 0x00000000;
		u[32] = 0x00000000;
		u[33] = 0x00000000;
		u[34] = 0x00000000;
		u[35] = 0x00000002;
		u[36] = 0x00000000;

		return this;

	}

	// ## parse(rs)
	parse(rs) {
		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		const u = this.u;
		u[0] = rs.byte();
		this.appearance = rs.byte();
		u[1] = rs.dword();
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();

		// Read sgprops. Note: according to the wiki no properties have ever 
		// been observed, but let's parse them anyway.
		let count = this.sgprops.length = rs.dword();
		for (let i = 0; i < count; i++) {
			let prop = this.sgprops[i] = new SGProp();
			prop.parse(rs);
		}

		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();

		u[2] = rs.byte();
		this.xMax = rs.float();
		this.yMax = rs.float();
		this.zMax = rs.float();
		this.xMin = rs.float();
		this.yMin = rs.float();
		this.zMin = rs.float();

		u[3] = rs.float();
		u[4] = rs.float();
		u[5] = rs.dword();
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();

		u[6] = rs.float();
		u[7] = rs.float();
		u[8] = rs.dword();
		this.x2 = rs.float();
		this.y2 = rs.float();
		this.z2 = rs.float();

		u[9] = rs.float();
		u[10] = rs.float();
		u[11] = rs.dword();
		this.x3 = rs.float();
		this.y3 = rs.float();
		this.z3 = rs.float();

		u[12] = rs.float();
		u[13] = rs.float();
		u[14] = rs.dword();

		this.textureId = rs.dword();
		for (let i = 15; i <= 19; i++) {
			u[i] = rs.byte();
		}

		this.orientation = rs.byte();

		u[20] = rs.byte();
		u[21] = rs.byte();

		// Apparantly the next byte is a count, but I don't know for what 
		// though.
		count = this.unknownReps.length = u[22] = rs.byte();
		for (let i = 0; i < count; i++) {
			this.unknownReps[i] = rs.slice(5);
		}

		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();

		u[23] = rs.byte();
		u[24] = rs.byte();
		u[25] = rs.byte();
		u[26] = rs.byte();

		this.xMin2 = rs.float();
		this.xMax2 = rs.float();
		this.yMin2 = rs.float();
		this.yMax2 = rs.float();
		this.zMin2 = rs.float();
		this.zMax2 = rs.float();

		u[27] = rs.byte();
		u[28] = rs.byte();
		u[29] = rs.byte();
		u[30] = rs.byte();
		u[31] = rs.dword();
		u[32] = rs.dword();
		u[33] = rs.dword();
		u[34] = rs.dword();
		u[35] = rs.dword();
		u[36] = rs.dword();

		let diff = rs.i-start;
		if (diff !== size) {
			console.warn([
				'Error while reading network tile!',
				`Size is ${size}, but read ${diff} bytes!`
			].join(' '));
			rs.jump(start+size);
		}

		return this;

	}

	// ## *bgen(opts)
	*bgen(opts) {

		// Create a buffer for the first part until the sgprops. This part has 
		// a fixed size of 36 bytes.
		let one = Buffer.allocUnsafe(36);
		let ws = new WriteStream(one);
		ws.jump(8);

		// Start writing.
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		const u = this.u;
		ws.byte(u[0]);
		ws.byte(this.appearance);
		ws.dword(u[1]);
		ws.byte(this.xMinTract);
		ws.byte(this.zMinTract);
		ws.byte(this.xMaxTract);
		ws.byte(this.zMaxTract);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		ws.dword(this.sgprops.length);

		// Handle the props.
		let props = this.sgprops.map(x => x.toBuffer());

		// Continue writing. The rest has a size of 199 + 5 times the size of 
		// the unknown reps of 5 bytes.
		let two = Buffer.allocUnsafe(195 + 5*this.unknownReps.length);
		ws = new WriteStream(two);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.byte(u[2]);
		ws.float(this.xMax);
		ws.float(this.yMax);
		ws.float(this.zMax);
		ws.float(this.xMin);
		ws.float(this.yMin);
		ws.float(this.zMin);
		ws.float(u[3]);
		ws.float(u[4]);
		ws.dword(u[5]);
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		ws.float(u[6]);
		ws.float(u[7]);
		ws.dword(u[8]);
		ws.float(this.x2);
		ws.float(this.y2);
		ws.float(this.z2);
		ws.float(u[9]);
		ws.float(u[10]);
		ws.dword(u[11]);
		ws.float(this.x3);
		ws.float(this.y3);
		ws.float(this.z3);
		ws.float(u[12]);
		ws.float(u[13]);
		ws.dword(u[14]);
		ws.dword(this.textureId);
		ws.byte(u[15]);
		ws.byte(u[16]);
		ws.byte(u[17]);
		ws.byte(u[18]);
		ws.byte(u[19]);
		ws.byte(this.orientation);
		ws.byte(u[20]);
		ws.byte(u[21]);
		ws.byte(this.unknownReps.length);
		for (let i = 0; i < this.unknownReps.length; i++) {
			ws.write(this.unknownReps[i]);
		}
		ws.byte(this.networkType);
		ws.byte(this.westConnection);
		ws.byte(this.northConnection);
		ws.byte(this.eastConnection);
		ws.byte(this.southConnection);
		ws.byte(u[23]);
		ws.byte(u[24]);
		ws.byte(u[25]);
		ws.byte(u[26]);
		ws.float(this.xMin2);
		ws.float(this.xMax2);
		ws.float(this.yMin2);
		ws.float(this.yMax2);
		ws.float(this.zMin2);
		ws.float(this.zMax2);
		ws.byte(u[27]);
		ws.byte(u[28]);
		ws.byte(u[29]);
		ws.byte(u[30]);
		ws.dword(u[31]);
		ws.dword(u[32]);
		ws.dword(u[33]);
		ws.dword(u[34]);
		ws.dword(u[35]);
		ws.dword(u[36]);

		// Concatenate & yield.
		let out = Buffer.concat([one, ...props, two]);
		out.writeUInt32LE(out.byteLength, 0);
		out.writeUInt32LE(this.crc = crc32(out, 8), 4);

		yield out;

	}

}
module.exports = Network;