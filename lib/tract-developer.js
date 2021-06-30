// # tract-developer.js
const Stream = require('./stream.js');
const WriteStream = require('./write-stream.js');
const Type = require('./type.js');
const { FileType } = require('./enums.js');
const crc32 = require('./crc.js');

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
		let size = 31 + 4*this.styles.length;
		let buff = Buffer.allocUnsafe(size);
		let ws = new WriteStream(buff);

		// Size & crc are for later. Start at offset 8.
		ws.jump(8);
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

		// Calculate CRC & yield.
		buff.writeUInt32LE(buff.byteLength, 0);
		buff.writeUInt32LE(this.crc = crc32(buff, 8), 4);
		return buff;

	}

}
module.exports = TractDeveloper;
