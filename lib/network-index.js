// # network-index.js
'use strict';
const Type = require('./type.js');
const Stream = require('./stream.js');
const Unknown = require('./unknown.js');
const { chunk } = require('./util.js');

String.prototype.chunk = function(format = Array(100).fill(8)) {
	return chunk(format, this);
};

// # NetworkIndex
class NetworkIndex extends Type(0x6a0f82b2) {

	// ## constructor()
	constructor() {
		super();
		this.mem = 0x00000000;
		this.crc = 0x00000000;
		this.major = 0x0007;
		this.cityTiles = 4096;
		this.networkTiles = 0;
	}

	// ## parse(buffer)
	parse(buffer) {
		const u = new Unknown(this);
		let rs = new Stream(buffer);
		let size = rs.dword();
		this.mem = rs.dword();
		this.crc = rs.dword();
		this.major = rs.word();
		this.cityTiles = rs.dword();
		this.networkTiles = rs.array(() => rs.struct(NetworkIndexTile));
		this.networkBlocks = rs.array(() => rs.struct(NetworkBlock));

		u.dword(rs.dword());
		u.dword(rs.dword());
		u.dword(rs.dword());
		this.tileX = rs.dword();
		this.tileZ = rs.dword();
		// console.log(rs.buffer.slice(rs.i, rs.i+100).toString('hex').chunk([8, 2, 8]));
		// console.log(rs.float());
		// rs.i-=4;

		u.float(rs.float());
		u.bool(rs.bool());
		u.float(rs.float());
		u.bool(rs.bool());
		if (this.major === 0x0007) {
			this.more = rs.array(() => {
				return {
					pointer: rs.pointer(),
					bytes: rs.read(32),
				};
			});
		}
		rs.assert();
	}

}
module.exports = NetworkIndex;

let types = new Set();
let us = [];
class NetworkIndexTile {

	// ## parse(rs)
	parse(rs) {
		let u = new Unknown(this);
		us.push(this);
		this.nr = rs.dword();
		this.x = this.nr % 128;
		this.z = Math.floor(this.nr / 128);
		this.pointer = rs.pointer();
		this.blocks = rs.array(() => {
			return {
				nr: rs.dword(),
				bytes: rs.array(() => rs.read(8)),
			};
		});
		this.automata = rs.array(() => rs.pointer());
		u.byte(rs.byte());
		u.dword(rs.dword());
		u.dword(rs.dword());
		u.dword(rs.dword());
		this.reps = [];
		for (let i = 0; i < 4; i++) {
			this.reps.push([
				rs.float(),
				rs.word(),
				rs.word(),
				rs.word(),
				rs.word(),
			]);
		}

		u.word(rs.word());
		// Next follows an array where each record counts 10 bytes.
		this.reps2 = rs.array(() => {
			return {
				nr: rs.dword(),
				bytes: rs.read(6),
			};
		});
	}

	// ## [Symbol.toPrimitive]()
	[Symbol.toPrimitive]() {
		return this.nr;
	}

}

class NetworkBlock {

	// ## parse(rs)
	parse(rs) {
		this.pointer = rs.pointer();
		this.buffer = rs.read(73);
	}

}
