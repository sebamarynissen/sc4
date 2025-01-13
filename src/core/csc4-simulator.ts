// # csc4-simulator.ts
import type { dword } from 'sc4/types';
import FileType from './file-types.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import Unknown from './unknown.js';
import WriteBuffer from './write-buffer.js';
import SimulatorDate from './simulator-date.js';

export default class cSC4Simulator {
	static [kFileType] = FileType.cSC4Simulator;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version = '4';
	hoursPerDay: dword = 24;
	dayOfYear: dword = 1;
	weekOfYear: dword = 1;
	monthOfYear: dword = 0;
	year: dword = 2000;
	date = SimulatorDate.epoch();
	unknown = new Unknown()
		.byte(0x00)
		.byte(0x01)
		.dword(0x00000001)
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(17)
		.dword(0x00000000)
		.byte(0x00)
		.dword(0x00000000)
		.byte(0x00)
		.dword(0x00000000)
		.byte(0x00)
		.byte(0x00)
		.byte(0x00)
		.byte(0x00)
		.byte(0x00)
		.byte(0x00)
		.dword(0x00000000)
		.byte(0x00)
		.dword(0x00000000)
		.byte(0x00)
		.dword(0x00000000)
		.byte(0x00);
	parse(rs: Stream) {
		rs.size();
		this.unknown = new Unknown();
		let unknown = this.unknown.reader(rs);
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.version(1);
		unknown.byte();
		unknown.byte();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		this.hoursPerDay = rs.dword();
		unknown.byte();
		this.dayOfYear = rs.dword();
		unknown.byte();
		this.weekOfYear = rs.dword();
		unknown.byte();
		this.monthOfYear = rs.dword();
		unknown.byte();
		this.year = rs.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		this.date = rs.date();
		rs.assert();
	}
	toBuffer() {
		let ws = new WriteBuffer();
		let unknown = this.unknown.writer(ws);
		ws.dword(this.mem);
		ws.version(this.version);
		unknown.byte();
		unknown.byte();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		ws.dword(this.hoursPerDay);
		unknown.byte();
		ws.dword(this.dayOfYear);
		unknown.byte();
		ws.dword(this.weekOfYear);
		unknown.byte();
		ws.dword(this.monthOfYear);
		unknown.byte();
		ws.dword(this.year);
		unknown.byte();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		unknown.byte();
		ws.date(this.date);
		return ws.seal();
	}
}
