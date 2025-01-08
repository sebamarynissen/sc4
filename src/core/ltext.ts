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
	encoding = 0x1000;
	constructor(value = '', encoding = 0x1000) {
		this.value = value;
		this.encoding = encoding;
	}

	// ## toString()
	toString() {
		return this.value;
	}

	// ## parse(rs)
	// There's something we didn't know before: the control character determines 
	// whether the encoding uses 1 or 2 bytes!
	parse(rs: Stream) {
		let length = rs.word();
		let cc = this.encoding = rs.word();
		let value = '';
		const reader = cc === 0 ? () => rs.byte() : () => rs.word();
		for (let i = 0; i < length; i++) {
			value += String.fromCharCode(reader());
		}
		this.value = value;
	}

	// ## toBuffer()
	toBuffer() {
		let cc = this.encoding;
		let writer = cc === 0 ?
			(char: number) => ws.byte(char) :
			(char: number) => ws.word(char);
		let ws = new WriteBuffer();
		ws.word(this.value.length);
		ws.word(cc);
		for (let char of this.value) {
			writer(char.charCodeAt(0));
		}
		return ws.toUint8Array();
	}

}
