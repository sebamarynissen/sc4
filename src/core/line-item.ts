// # line-item.js
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type Stream from './stream.js';

// # LineItem
// A line item is part of the city budget simulator. It contains the monthly 
// expenses or income from a specific building.
export default class LineItem {

	static [kFileType] = FileType.LineItem;
	static [kFileTypeArray] = true;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0004;
	name = '';
	sections = 0;
	unknown1 = 0x00000000;
	cost = 0n;
	expense = 0n;
	revenue = 0n;
	unknown2: Uint8Array;

	// ## parse(rs)
	// Parses the budget line item from a buffer wrapped up in a readable 
	// stream.
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.name = rs.string();
		this.sections = rs.dword();
		this.unknown1 = rs.dword();
		this.cost = rs.qword();
		this.expense = rs.qword();
		this.revenue = rs.qword();
		this.unknown2 = rs.read();
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.string(this.name);
		ws.dword(this.sections);
		ws.dword(this.unknown1);
		ws.qword(this.cost);
		ws.qword(this.expense);
		ws.qword(this.revenue);
		return ws.seal();
	}

}
