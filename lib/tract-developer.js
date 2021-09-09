// # tract-developer.js
'use strict';
const Stream = require('./stream.js');
const WriteBuffer = require('./write-buffer.js');
const Type = require('./type.js');
const { FileType } = require('./enums.js');

// # TractDeveloper
// See https://community.simtropolis.com/forums/topic/758810-partial-
// mythbusting-building-style-tilesets-not-locked-down-in-the-exe/?tab=comments
// #comment-1724876. The TractDeveloper file holds which tilesets are 
// currently active in the city.
class TractDeveloper extends Type(FileType.TractDeveloper) {

	// ## constructor()
	constructor() {
		super();
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.u1 = 0x0003;
		this.u2 = 0x0000;
		this.u3 = 0x0000;
		this.u4 = 0x0000;
		this.u5 = 0x0000;
		this.u6 = 0x01;
		this.styles = [];
		this.years = 5;
	}

	// ## parse(buff)
	parse(buff) {
		let rs = new Stream(buff);
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.u1 = rs.word();
		this.u2 = rs.word();
		this.u3 = rs.word();
		this.u4 = rs.word();
		this.u5 = rs.word();
		this.u6 = rs.byte();
		const length = rs.dword();
		let styles = this.styles = [];
		for (let i = 0; i < length; i++) {
			styles.push(rs.dword());
		}
		this.years = rs.dword();
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.u1);
		ws.word(this.u2);
		ws.word(this.u3);
		ws.word(this.u4);
		ws.word(this.u5);
		ws.byte(this.u6);
		ws.dword(this.styles.length);
		for (let style of this.styles) {
			ws.dword(style);
		}
		ws.dword(this.years);
		return ws.seal();

	}

}
module.exports = TractDeveloper;
