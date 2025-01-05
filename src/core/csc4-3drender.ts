// # csc4-3drender.ts
import type { dword, uint32, word } from 'sc4/types';
import FileType from './file-types.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import Unknown from './unknown.js';
import type Pointer from './pointer.js';

export default class cSC43DRender {
	static [kFileType] = FileType.cSC43DRender;
	mem: dword = 0x00000000;
	crc: dword = 0x00000000;
	version: word = 0x0002;
	size: [uint32, uint32];
	resolution: [uint32, uint32];
	camera: Pointer;
	unknown = new Unknown()
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x00000006)
		.dword(0x00000000)
		.dword(0x00000003);
	parse(rs: Stream) {
		this.unknown = new Unknown();
		let u = this.unknown.reader(rs);
		rs.size();
		this.mem = rs.dword();
		this.crc = rs.dword();
		this.version = rs.word();
		this.size = [rs.uint32(), rs.uint32()];
		u.dword();
		u.dword();
		this.resolution = [rs.uint32(), rs.uint32()];
		this.camera = rs.pointer()!;
		u.dword();
		u.dword();
		u.dword();
		rs.assert();
	}
}
