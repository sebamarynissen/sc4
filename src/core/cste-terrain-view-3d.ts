import type { dword, word } from 'sc4/types';
import FileType from './file-types.js';
import { kFileType } from './symbols.js';
import type Stream from './stream.js';
import WriteBuffer from './write-buffer.js';

// # cste-terrain-view-3d.ts
export default class cSTETerrainView3D {
	static [kFileType] = FileType.cSTETerrainView3D;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version: word = 0x0001;
	grid: boolean = true;
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.word();
		this.grid = rs.bool();
	}
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.version);
		ws.bool(this.grid);
		return ws.seal();
	}
}
