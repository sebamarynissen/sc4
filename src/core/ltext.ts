// # ltext.ts
import { FileType } from './enums.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import WriteBuffer from './write-buffer.js';

// # LTEXT
// Implementation of the LTEXT file type.
export default class LText {
	static [kFileType] = FileType.LTEXT;
	value = '';
	constructor(value = '') {
		this.value = value;
	}

	// ## toString()
	toString() {
		return this.value;
	}

	// ## parse(rs)
	parse(rs: Stream) {
		let length = rs.word();
		rs.skip(2);
		let value = '';
		for (let i = 0; i < length; i++) {
			let char = rs.word();
			value += String.fromCharCode(char);
		}
		this.value = value;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.word(this.value.length);
		ws.uint8(0);
		ws.uint8(0x10);
		for (let char of this.value) {
			ws.word(char.charCodeAt(0));
		}
		return ws.toUint8Array();
	}

}
