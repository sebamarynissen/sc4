// # park-manager.ts
import type { dword } from 'sc4/types';
import FileType from './file-types.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import type Pointer from './pointer.js';
import type Building from './building.js';
import WriteBuffer from './write-buffer.js';

export default class ParkManager {
	static [kFileType] = FileType.ParkManager;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version = '2';
	buildings: Pointer<Building>[] = [];
	unknown: dword = 0x00000000;
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.version(1);
		this.buildings = rs.array(() => rs.pointer()!);
		this.unknown = rs.dword();
		rs.assert();
	}
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.version(this.version);
		ws.array(this.buildings, ptr => ws.pointer(ptr));
		ws.dword(this.unknown);
		return ws.seal();
	}
}
