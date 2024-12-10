// # tract-developer.ts
import type { dword } from 'sc4/types';
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';

// # TractDeveloper
// See https://community.simtropolis.com/forums/topic/758810-partial-
// mythbusting-building-style-tilesets-not-locked-down-in-the-exe/?tab=comments
// #comment-1724876. The TractDeveloper file holds which tilesets are 
// currently active in the city.
export default class TractDeveloper {

	static [kFileType] = FileType.TractDeveloper;

	crc = 0x00000000;
	mem = 0x00000000;
	u1 = 0x0003;
	u2 = 0x0000;
	u3 = 0x0000;
	u4 = 0x0000;
	u5 = 0x0000;
	u6 = 0x01;
	styles: dword[] = [];
	years = 5;

	// ## parse(buff)
	parse(buff: Stream | Uint8Array) {
		let rs = new Stream(buff);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.u1 = rs.word();
		this.u2 = rs.word();
		this.u3 = rs.word();
		this.u4 = rs.word();
		this.u5 = rs.word();
		this.u6 = rs.byte();
		const length = rs.dword();
		this.styles = [];
		for (let i = 0; i < length; i++) {
			this.styles.push(rs.dword());
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
