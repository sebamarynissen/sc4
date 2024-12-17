// # cste-terrain.ts
import WriteBuffer from './write-buffer.js';
import { kFileType } from './symbols.js';
import FileType from './file-types.js';
import type { dword, word } from 'sc4/types';
import type Pointer from './pointer.js';
import type Stream from './stream.js';

// # cSTETerrain
export default class cSTETerrain {
	static [kFileType] = FileType.cSTETerrain;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version: word = 0x0002;
	terrainView: Pointer | null = null;
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.word();
		this.terrainView = rs.pointer();
		rs.assert();
	}
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.version);
		ws.pointer(this.terrainView);
		return ws.seal();
	}
}
