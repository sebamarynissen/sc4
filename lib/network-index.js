// # network-index.js
'use strict';
const Type = require('./type.js');
const Stream = require('./stream.js');
const Unknown = require('./unknown.js');
const { chunk } = require('./util.js');

String.prototype.chunk = function(format = []) {
	return chunk([...format, ...Array(4*1024).fill(8)], this);
};

// # NetworkIndex
class NetworkIndex extends Type(0x6a0f82b2) {

	// ## constructor()
	constructor() {
		super();
		let u = new Unknown(this);
		this.mem = 0x00000000;
		this.crc = 0x00000000;
		this.major = 0x0007;
		this.cityTiles = 4096;
		this.networkTiles = [];
		this.intersections = [];
		this.transitEnabledTiles = [];
		u.dword(0x00000000);
		u.dword(0x00000000);
		this.tileX = 0x00000000;
		this.tileZ = 0x00000000;
		u.bytes([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		this.yIntersections = [];
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
		this.intersections = rs.array(() => rs.struct(NetworkIntersection));
		this.transitEnabledTiles = rs.array(() => {
			return {
				z: rs.word(),
				x: rs.word(),
				dword: rs.dword(),
				pointer: rs.pointer(),
			};
		});

		// Don't know what happens below lol.
		u.dword(rs.dword());
		u.dword(rs.dword());
		this.tileX = rs.dword();
		this.tileZ = rs.dword();
		u.bytes(rs.read(10));

		// Next another array of pointers follows, either of type 0xc9c05c6e
		// (NetworkOccupant), or 0x49c1a034 (
		// NetworkOccupantWithPrebuiltModel). We don't really understand what 
		// those represent, but they have something to do with complex Y and Ψ
		// intersections. 
		this.yIntersections = rs.array(() => {
			let pointer = rs.pointer();
			let a1 = rs.array(() => rs.dword());
			let w1 = rs.word();
			let a2 = rs.array(() => rs.dword());
			let w2 = rs.word();
			let a3 = rs.array(() => rs.dword());
			let w3 = rs.word();
			let a4 = rs.array(() => rs.dword());
			let w4 = rs.word();
			return {
				pointer,
				a1, w1,
				a2, w2,
				a3, w3,
				a4, w4,
			};
		});
		rs.assert();
		return;

	}

}
module.exports = NetworkIndex;

class NetworkIndexTile {

	// ## parse(rs)
	parse(rs) {
		let u = new Unknown(this);
		this.nr = rs.dword();
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

// # NetworkIntersection
// The class for respenting an intersection on the network. Note that those 
// tiles already appear as well in the normal tiles array! This is just an 
// additional structure somehow.
class NetworkIntersection {

	// ## parse(rs)
	parse(rs) {
		let u = new Unknown(this);
		this.pointer = rs.pointer();
		u.byte(rs.byte());
		u.dword(rs.dword());
		for (let dir of ['west', 'north', 'east', 'south']) {

			// Next the game does something strange. We have to read in a 
			// count, but it does not specify the size of an array, instead it 
			// specifies how many *meaningful* floats there are to follow!
			let count = rs.dword();
			let arr = this[dir] = [rs.bool()];
			let i = 0;
			for (; i < count; i++) {

				// Skip first two bytes, seems like they don't matter.
				rs.skip(2);
				arr.push(rs.read(2));

			}

			// Now discard the remaining garbage data.
			for (; i < 3; i++) {
				rs.skip(4);
			}

		}
	}

}
