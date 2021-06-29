// # department-budget.js
'use strict';
const Stream = require('./stream.js');
const WriteStream = require('./write-stream');
const crc32 = require('./crc.js');
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
		this.u1 = null;
		this.name = '';
		this.u2 = null;
		this.lineItems = [];
		this.purposes = [];
		this.u3 = 0x00000000;
		this.u4 = 0x00000000;
	}

	// ## parse(rs)
	// Parses the department budget from a buffer wrapped in a readable stream.
	parse(rs) {

		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.u1 = rs.read(5);
		this.name = rs.string();
		this.u2 = rs.read(21);

		// Read in the pointers to our child line items.
		let items = this.lineItems = new Array(rs.dword());
		for (let i = 0; i < items.length; i++) {
			items[i] = rs.pointer();
		}

		let purposes = this.purposes = new Array(rs.dword());
		for (let i = 0; i < purposes.length; i++) {
			let building = rs.pointer();
			let id = rs.dword();
			purposes[i] = {
				building,
				id,
			};
		}

		// 8 bytes remaining.
		this.u3 = rs.dword();
		this.u4 = rs.dword();

	}

}
module.exports = DepartmentBudget;
