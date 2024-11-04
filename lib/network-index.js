// # network-index.js
'use strict';
const Stream = require('./stream.js');
const WriteBuffer = require('./write-buffer.js');
const Unknown = require('./unknown.js');
const { FileType } = require('./enums.js');

// # NetworkIndex
class NetworkIndex {

	static [Symbol.for('sc4.type')] = FileType.NetworkIndex;

	// ## constructor()
	constructor() {
		let u = new Unknown(this);
		this.mem = 0x00000000;
		this.crc = 0x00000000;
		this.major = 0x0007;
		this.cityTiles = 4096;
		this.tiles = [];
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
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.cityTiles = rs.dword();
		this.tiles = rs.array(() => rs.struct(NetworkIndexTile));
		this.intersections = rs.array(() => rs.struct(NetworkIntersection));
		this.transitEnabledTiles = rs.array(() => {
			return rs.struct(TransitEnabledTile);
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
		if (this.major !== 0x003) {
			this.yIntersections = rs.array(() => {
				return rs.struct(ComplexIntersection);
			});
		}
		rs.assert();
		return;

	}

	// ## toBuffer()
	toBuffer() {
		const unknown = this.unknown.generator();
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.cityTiles);
		ws.array(this.tiles);
		ws.array(this.intersections);
		ws.array(this.transitEnabledTiles);
		ws.dword(unknown());
		ws.dword(unknown());
		ws.dword(this.tileX);
		ws.dword(this.tileZ);
		ws.write(unknown());
		ws.array(this.yIntersections);
		return ws.seal();
	}

	// ## tile(opts)
	// Helper function for creating a new tile. Note that it doesn't insert 
	// it, you have to do this manually!
	tile(...args) {
		return new NetworkIndexTile(...args);
	}

}
module.exports = NetworkIndex;

// # NetworkIndexTile
// Class for representing a tile in the network index.
class NetworkIndexTile {

	// ## constructor()
	constructor() {
		let u = new Unknown(this);
		this.nr = 0;
		this.pointer = null;
		this.blocks = [];
		this.automata = [];
		u.byte(0x00);
		u.dword(0x00000000);
		u.dword(0x00000000);
		u.dword(0x00000000);
		this.reps = [
			Buffer.alloc(12),
			Buffer.alloc(12),
			Buffer.alloc(12),
			Buffer.alloc(12),
		];
		u.dword(0x00000000);
		this.reps2 = [];
	}

	// ## parse(rs)
	parse(rs) {
		let u = new Unknown(this);
		this.nr = rs.dword();
		this.pointer = rs.pointer();
		this.blocks = rs.array(() => {
			let nr = rs.dword();
			return {
				nr,
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
			this.reps.push(rs.read(12));
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

	// ## write(ws)
	write(ws) {
		let unknown = this.unknown.generator();
		ws.dword(this.nr);
		ws.pointer(this.pointer);
		ws.array(this.blocks, block => {
			ws.dword(block.nr);
			ws.array(block.bytes, bytes => ws.write(bytes));
		});
		ws.array(this.automata, ptr => ws.pointer(ptr));
		ws.byte(unknown());
		ws.dword(unknown());
		ws.dword(unknown());
		ws.dword(unknown());
		for (let rep of this.reps) {
			ws.write(rep);
		}
		ws.word(unknown());
		ws.array(this.reps2, item => {
			ws.dword(item.nr);
			ws.write(item.bytes);
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
			// specifies how many *meaningful* blocks there are to follow! 
			// Nevertheless we still read in everything because we want to 
			// check if reserializing happens correctly! Just know that you 
			// can discard the values!
			let count = rs.dword();
			let bool = rs.bool();
			let array = [];
			for (let i = 0; i < 3; i++) {
				let bytes = rs.read(4);
				array.push({
					bytes,
					ignore: i >= count,
				});
			}
			this[dir] = { bool, array };

		}
	}

	// ## write(ws)
	write(ws) {
		let unknown = this.unknown.generator();
		ws.pointer(this.pointer);
		ws.byte(unknown());
		ws.dword(unknown());
		for (let dir of ['west', 'north', 'east', 'south']) {
			let { array, bool } = this[dir];
			let { length } = array.filter(({ ignore }) => !ignore);
			ws.dword(length);
			ws.bool(bool);
			for (let { bytes } of array) {
				ws.write(bytes);
			}
		}
	}

}

// # TransitEnabledTile
// The class for representing a transit enabled tile in the network index.
class TransitEnabledTile {

	// ## constructor()
	constructor() {
		this.x = 0x0000;
		this.z = 0x0000;
		this.dword = 0x00000000;
		this.pointer = null;
	}

	// ## parse(rs)
	parse(rs) {
		this.z = rs.word();
		this.x = rs.word();
		this.dword = rs.dword();
		this.pointer = rs.pointer();
	}

	// ## write(ws)
	write(ws) {
		ws.word(this.z);
		ws.word(this.x);
		ws.dword(this.dword);
		ws.pointer(this.pointer);
	}

}

// # ComplexIntersection
// The class for representing complex Y intersections in the network index. 
// They are not fully understood yet though.
class ComplexIntersection {

	// ## constructor()
	constructor() {
		this.pointer = null;
		this.west = null;
		this.north = null;
		this.east = null;
		this.south = null;
	}

	// ## parse(rs)
	parse(rs) {
		this.pointer = rs.pointer();
		for (let dir of ['west', 'north', 'east', 'south']) {
			this[dir] = {
				array: rs.array(() => rs.dword()),
				word: rs.word(),
			};
		}
	}

	// ## write(ws)
	write(ws) {
		ws.pointer(this.pointer);
		for (let dir of ['west', 'north', 'east', 'south']) {
			let struct = this[dir];
			ws.array(struct.array, dword => ws.dword(dword));
			ws.word(struct.word);
		}
	}

}
