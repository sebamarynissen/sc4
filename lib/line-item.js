// # line-item.js
'use strict';
const Stream = require('./stream.js');
const WriteBuffer = require('./write-buffer.js');
const Type = require('./type.js');
const { FileType } = require('./enums.js');

// # LineItem
// A line item is part of the city budget simulator. It contains the monthly 
// expenses or income from a specific building.
class LineItem extends Type(FileType.LineItem) {

	// ## constructor(opts)
	constructor(opts) {
		super(opts);
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0004;
		this.name = '';
		this.sections = 0;
		this.unknown1 = 0x00000000;
		this.cost = 0n;
		this.expense = 0n;
		this.revenue = 0n;
		this.unknown2 = null;
	}

	// ## parse(rs)
	// Parses the budget line item from a buffer wrapped up in a readable 
	// stream.
	parse(rs) {

		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.name = rs.string();
		this.sections = rs.dword();
		this.unknown1 = rs.dword();
		this.cost = rs.qword();
		this.expense = rs.qword();
		this.revenue = rs.qword();

		// Skip all the rest now.
		let read = rs.i - start;
		let rest = size - read;
		this.unknown2 = rs.read(rest);

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
module.exports = LineItem;
