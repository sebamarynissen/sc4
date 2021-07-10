// # region-view-file.js
'use strict';
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
		this.z = this.x = 0;
		this.zSize = this.zSize = 0;
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
		this.z = rs.dword();
		this.xSize = rs.dword();
		this.zSize = rs.dword();

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return this.buffer;
	}

}
module.exports = RegionViewFile;