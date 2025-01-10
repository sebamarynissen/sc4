// # csc4-24hour-clock.ts
import type { dword } from 'sc4/types';
import FileType from './file-types.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import Unknown from './unknown.js';
import WriteBuffer from './write-buffer.js';

export default class cSC424HourClock {
	static [kFileType] = FileType.cSC424HourClock;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version = '2';
	secondOfDay = 0;
	unknown = new Unknown()
		.dword(0x00000000)
		.float(135)
		.float(2000)
		.dword(0x00000014)
		.dword(0x00000001);
	parse(rs: Stream) {
		rs.size();
		this.unknown = new Unknown();
		let unknown = this.unknown.reader(rs);
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.version(1);
		unknown.dword();
		unknown.float();
		unknown.float();
		this.secondOfDay = rs.dword();
		unknown.dword();
		unknown.dword();
	}
	toBuffer() {
		let ws = new WriteBuffer();
		let unknown = this.unknown.writer(ws);
		ws.dword(this.mem);
		ws.version(this.version);
		unknown.dword();
		unknown.float();
		unknown.float();
		ws.dword(this.secondOfDay);
		unknown.dword();
		unknown.dword();
		return ws.seal();
	}
}
