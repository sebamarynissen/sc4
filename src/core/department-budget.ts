// # department-budget.js
import type { dword } from 'sc4/types';
import { FileType } from './enums.js';
import type Pointer from './pointer.js';
import type Stream from './stream.js';
import { kFileType, kFileTypeArray } from './symbols.js';

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
		let items = this.lineItems = new Array(rs.dword());
		for (let i = 0; i < items.length; i++) {
			items[i] = rs.pointer();
		}

		let buildings = this.buildings = new Array(rs.dword());
		for (let i = 0; i < buildings.length; i++) {
			let pointer = rs.pointer();
			let purpose = rs.dword();
			buildings[i] = {
				pointer,
				purpose,
			};
		}

		// 8 bytes remaining, might be a pointer.
		this.u4 = rs.dword();
		this.u5 = rs.dword();

	}

}
