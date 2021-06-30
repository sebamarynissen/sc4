// # flora-file.js
"use strict";
const deprecate = require('util-deprecate');
const Stream = require('./stream');
const WriteBuffer = require('sc4/lib/write-buffer.js');
const SGProp = require('./sgprop');
const { FileType } = require('./enums');
const Type = require('./type');
const { getUnixFromJulian, getJulianFromUnix } = require('./julian-date');

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
		this.cycleDate = new Date();
		this.appearanceDate = new Date();
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
		this.cycleDate.setTime(getUnixFromJulian(rs.dword()));
		this.appearanceDate.setTime(getUnixFromJulian(rs.dword()));
		this.state = rs.byte();
		this.orientation = rs.byte();
		this.objectId = rs.dword();

		// Done
		return this;

	}

	// ## toBuffer()
	toBuffer() {

		// Start writing.
		let ws = new WriteBuffer();
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
		this.sgprops.forEach(prop => ws.write(prop.toBuffer()));

		// Continue writing.
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.dword(this.IID1);
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		ws.dword(getJulianFromUnix(this.cycleDate));
		ws.dword(getJulianFromUnix(this.appearanceDate));
		ws.byte(this.state);
		ws.byte(this.orientation);
		ws.dword(this.objectId);
		return ws.seal();

	}

	// ## *bgen()
	*bgen() {
		yield this.toBuffer();
	}

}
module.exports = Flora;

// Support .flora access for legacy purpuses, but deprecate it.
Object.defineProperty(Flora.Array, 'flora', {
	"get": deprecate(function() {
		return this;
	}, '.flora is deprecated, use class as array instead')
});