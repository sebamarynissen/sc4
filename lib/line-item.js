// # line-item.js
'use strict';
const Stream = require('./stream.js');
const WriteStream = require('./write-stream');
const crc32 = require('./crc.js');
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

	// ## *bgen(opts)
	*bgen() {

		// Prepare the first fixed-size part and skip the 8 first bytes because 
		// those will come later.
		let one = Buffer.allocUnsafe(18);
		let ws = new WriteStream(one);
		ws.jump(8);
		ws.dword(this.mem);
		ws.word(this.major);
		let string = Buffer.from(this.name, 'utf8');
		ws.dword(string.byteLength);

		// After the string comes another fixed-size part.
		let two = Buffer.allocUnsafe(32);
		ws = new WriteStream(two);
		ws.dword(this.sections);
		ws.dword(this.unknown1);
		ws.qword(this.cost);
		ws.qword(this.expense);
		ws.qword(this.revenue);

		// Now concatenate everything and calculate the crc checksum.
		let out = Buffer.concat([one, string, two, this.unknown2]);
		out.writeUInt32LE(out.byteLength, 0);
		out.writeUInt32LE(this.crc = crc32(out, 8), 4);
		yield out;

	}

}
module.exports = LineItem;
