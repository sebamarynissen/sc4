// # network-manager.ts
import type { dword } from 'sc4/types';
import FileType from './file-types.js';
import { kFileType } from './symbols.js';
import type Pointer from './pointer.js';
import type Stream from './stream.js';
import WriteBuffer from './write-buffer.js';

// # NetworkManager
export default class NetworkManager {
	static [kFileType] = FileType.NetworkManager;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version = 1;
	pointers: Pointer[] = [];

	// ## parse(rs)
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.word();
		this.pointers = rs.array(() => rs.pointer()!);
		rs.assert();
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.version);
		ws.array(this.pointers, ptr => ws.pointer(ptr));
		return ws.seal();
	}

}
