// # region-view-file.js
"use strict";
const Stream = require('./stream');
const { FileType } = require('./enums');
const Type = require('./type');

// # RegionViewFile
class RegionViewFile extends Type(FileType.RegionViewFile) {

	// ## constructor()
	constructor() {
		super();
		this.buffer = null;
		this.major = 0x0001;
		this.minor = 0x000d;
		this.y = this.x = 0;
		this.ySize = this.ySize = 0;
	}

	// ## parse(buff)
	parse(buff) {
		this.buffer = buff;
		let rs = new Stream(this.buffer);

		// Partially read in. This stuff is pretty much read-only for now, no 
		// need to fully parse it yet.
		this.major = rs.word();
		this.minor = rs.word();
		this.x = rs.dword();
		this.y = rs.dword();
		this.xSize = rs.dword();
		this.ySize = rs.dword();

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

	// ## *bgen(opts)
	*bgen(opts) {
		yield this.buffer;
	}

}
module.exports = RegionViewFile;