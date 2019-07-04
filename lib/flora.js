// # flora-file.js
"use strict";
const deprecate = require('util-deprecate');
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const crc32 = require('./crc');
const SGProp = require('./sgprop');
const { FileType } = require('./enums');
const Type = require('./type');

// # Flora
// Represents a single flora item. Note that you want to register 
// **Flora.Array** as file for the DBPF files, not the flora class itself!
class Flora extends Type(FileType.FloraFile) {
	
	// ## constructor()
	constructor() {
		super();
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0003;
		this.minor = 0x0004;
		this.zot = 0x0000;
		this.u1 = 0x00;
		this.appearance = 0b00001101;
		this.u2 = 0x74758926;
		this.zMinTract = this.xMinTract = 0x00;
		this.zMaxTract = this.zMinTract = 0x00;
		this.zTractSize = this.xTractSize = 0x0002;
		this.sgprops = [];
		this.GID = 0x00000000;
		this.TID = 0x00000000;
		this.IID = 0x00000000;
		this.IID1 = 0x00000000;
		this.z = this.y = this.x = 0;
		this.cycleDate = 0x00000000;
		this.appearanceDate = 0x00000000;
		this.state = 0x00;
		this.orientation = 0x00;
		this.objectId = 0x00000000;
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
		this.u1 = rs.byte();
		this.appearance = rs.byte();
		this.u2 = rs.dword();
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();

		// Read properties.
		const count = this.sgprops.length = rs.dword();
		for (let i = 0; i < count; i++) {
			let prop = this.sgprops[i] = new SGProp();
			prop.parse(rs);
		}

		// Read group ids.
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.IID1 = rs.dword();
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();
		this.cycleDate = rs.dword();
		this.appearanceDate = rs.dword();
		this.state = rs.byte();
		this.orientation = rs.byte();
		this.objectId = rs.dword();

		// Done
		return this;

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return this.bgen(opts).next().value;
	}

	// ## *bgen(opts)
	*bgen(opts) {

		// Prepare the first part of the buffer.
		let one = Buffer.allocUnsafe(36);
		let ws = new WriteStream(one);
		ws.jump(8);

		// Write away, crc & size will come later.
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		ws.byte(this.u1);
		ws.byte(this.appearance);
		ws.dword(this.u2);
		ws.byte(this.xMinTract);
		ws.byte(this.zMinTract);
		ws.byte(this.xMaxTract);
		ws.byte(this.zMaxTract);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		ws.dword(this.sgprops.length);

		// Serialize all sgprops.
		let props = this.sgprops.map(x => x.toBuffer());

		// Continue writing.
		let two = Buffer.allocUnsafe(42);
		ws = new WriteStream(two);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.dword(this.IID1);
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		ws.dword(this.cycleDate);
		ws.dword(this.appearanceDate);
		ws.byte(this.state);
		ws.byte(this.orientation);
		ws.dword(this.objectId);

		// Concatenate & handle crc.
		let out = Buffer.concat([one, ...props, two]);
		out.writeUInt32LE(out.byteLength, 0);
		out.writeUInt32LE(this.crc = crc32(out, 8), 4);

		// Done, yield the buffer.
		yield out;

	}

}
module.exports = Flora;

// # FloraFile
// The class that we're going to export is actually an array-like class which 
// simply uses the "Flora" class as child class. Most of the functionality we 
// need is already set up this way.
const ArrayClass = Flora.ArrayClass = class FloraFile extends Flora.Array {};

// Support .flora access for legacy purpuses, but deprecate it.
Object.defineProperty(ArrayClass.prototype, 'flora', {
	"get": deprecate(function() {
		return this;
	}, '.flora is deprecated, use class as array instead')
});