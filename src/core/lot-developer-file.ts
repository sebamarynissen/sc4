// # lot-developer-file.ts
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';
import type Pointer from './pointer.js';
import type Building from './building.js';

// # LotDeveloper
export default class LotDeveloper {
	static [kFileType] = FileType.LotDeveloper;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0001;
	tileSize = 0x00000041;
	width = 0x44800000;
	depth = 0x44800000;
	buildings: Pointer<Building>[] = [];
	u3 = 0x00000000;
	u4 = 0x0000;

	// ## parse(buffer)
	parse(buffer: Uint8Array | Stream) {
		let rs = new Stream(buffer);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.tileSize = rs.dword();
		this.width = rs.float();
		this.depth = rs.float();

		// Read in the entries.
		let count = rs.dword();
		this.buildings = new Array(count);
		for (let i = 0; i < count; i++) {
			this.buildings[i] = rs.pointer()!;
		}

		// Read in the rest.
		this.u3 = rs.dword();
		this.u4 = rs.word();
		rs.assert();
		return this;
	}

	// ## clear()
	// Clears the lot developer file again.
	clear() {
		this.buildings = [];
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.tileSize);
		ws.float(this.width);
		ws.float(this.depth);
		ws.dword(this.buildings.length);
		for (let building of this.buildings) {
			ws.pointer(building);
		}
		ws.dword(this.u3);
		ws.word(this.u4);
		return ws.seal();
	}

}
