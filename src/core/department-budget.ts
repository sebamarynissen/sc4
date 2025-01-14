// # department-budget.js
import type { dword } from 'sc4/types';
import { FileType } from './enums.js';
import type Pointer from './pointer.js';
import type Stream from './stream.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import WriteBuffer from './write-buffer.js';

type Building = {
	pointer: Pointer;
	purpose: dword;
};

// # DepartmentBudget
// A JavaScript representation of a cSC4DepartmentBudget class.
export default class DepartmentBudget {
	static [kFileType] = FileType.DepartmentBudget;
	static [kFileTypeArray] = true;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x000a;
	u1 = 0x00;
	u2 = 0x00000000;
	name = '';
	u3: Uint8Array;
	lineItems: Pointer[] = [];
	buildings: Building[] = [];
	u4 = 0x00000000;
	u5 = 0x00000000;

	// ## parse(rs)
	// Parses the department budget from a buffer wrapped in a readable stream.
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.u1 = rs.byte();
		this.u2 = rs.float();
		this.name = rs.string();
		this.u3 = rs.read(21);

		// Read in the pointers to our child line items.
		this.lineItems = rs.array(() => rs.pointer()!);
		this.buildings = rs.array(() => {
			return {
				pointer: rs.pointer()!,
				purpose: rs.dword(),
			};
		});

		// 8 bytes remaining, might be a pointer.
		this.u4 = rs.dword();
		this.u5 = rs.dword();
		rs.assert();

	}
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.byte(this.u1);
		ws.float(this.u2);
		ws.string(this.name);
		ws.write(this.u3);
		ws.array(this.lineItems, ptr => ws.pointer(ptr));
		ws.array(this.buildings, record => {
			ws.pointer(record.pointer);
			ws.dword(record.purpose);
		});
		ws.dword(this.u4);
		ws.dword(this.u5);
		return ws.seal();
	}

}
