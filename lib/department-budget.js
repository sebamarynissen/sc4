// # department-budget.js
'use strict';
const Stream = require('./stream.js');
const WriteBuffer = require('./write-buffer.js');
const Type = require('./type.js');
const Pointer = require('./pointer.js');
const { FileType } = require('./enums.js');
const { chunk, hex } = require('../lib/util.js');

// # DepartmentBudget
// A JavaScript representation of a cSC4DepartmentBudget class.
class DepartmentBudget extends Type(FileType.DepartmentBudget) {

	// ## constructor(opts)
	constructor(opts) {
		super(opts);
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x000a;
		this.u1 = 0x00;
		this.u2 = 0x00000000;
		this.name = '';
		this.u3 = null;
		this.lineItems = [];
		this.buildings = [];
		this.u4 = 0x00000000;
		this.u5 = 0x00000000;
	}

	// ## parse(rs)
	// Parses the department budget from a buffer wrapped in a readable stream.
	parse(rs) {

		let start = rs.i;
		let size = rs.dword();
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
module.exports = DepartmentBudget;
