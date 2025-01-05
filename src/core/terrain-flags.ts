// # terrain-flags.ts
import type { word } from 'sc4/types';
import FileType from './file-types.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import { isLittleEndian } from 'sc4/utils';
import WriteBuffer from './write-buffer.js';

// # TerrainFlags
// A data structure that holds which terrain tiles get rendered.
export default class TerrainFlags {
	static [kFileType] = FileType.TerrainFlags;
	major: word = 0x0001;
	raw: Uint16Array;
	parse(rs: Stream) {
		this.major = rs.word();
		let buffer = rs.readArrayBuffer();
		let size = Math.sqrt(buffer.byteLength/2);
		let raw;
		if (isLittleEndian()) {
			raw = new Uint16Array(buffer);
		} else {
			raw = new Uint16Array(size**2);
			for (let i = 0; i < raw.length; i++) {
				raw[i] = rs.uint16();
			}
		}
		this.raw = raw;
		rs.assert();
		return this;
	}
	toBuffer(): Uint8Array {
		const ws = new WriteBuffer();
		ws.word(this.major);
		for (let i = 0; i < this.raw.length; i++) {
			ws.uint16(this.raw[i]);
		}
		return ws.toUint8Array();
	}

}
