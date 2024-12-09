// # network-index.js
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import Unknown from './unknown.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';
import type Pointer from './pointer.js';
import type { dword, word } from 'sc4/types';

// # NetworkIndex
export default class NetworkIndex {
	static[kFileType] = FileType.NetworkIndex;
	mem = 0x00000000;
	crc = 0x00000000;
	major = 0x0007;
	cityTiles = 4096;
	tiles: NetworkIndexTile[] = [];
	intersections: NetworkIntersection[] = [];
	transitEnabledTiles: TransitEnabledTile[] = [];
	tileX = 0x00000000;
	tileZ = 0x00000000;
	yIntersections: ComplexIntersection[] = [];
	u = new Unknown()
		.dword(0x00000000)
		.dword(0x00000000)
		.bytes([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

	// ## parse(buffer)
	parse(buffer: Stream | Uint8Array) {
		let rs = new Stream(buffer);
		const u = this.u.reader(rs);
		rs.size();
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
		u.dword();
		u.dword();
		this.tileX = rs.dword();
		this.tileZ = rs.dword();
		u.bytes(10);

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
		let ws = new WriteBuffer();
		const unknown = this.u.writer(ws);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.cityTiles);
		ws.array(this.tiles);
		ws.array(this.intersections);
		ws.array(this.transitEnabledTiles);
		unknown.dword();
		unknown.dword();
		ws.dword(this.tileX);
		ws.dword(this.tileZ);
		unknown.bytes();
		ws.array(this.yIntersections);
		return ws.seal();
	}

	// ## tile(opts)
	// Helper function for creating a new tile. Note that it doesn't insert 
	// it, you have to do this manually!
	tile() {
		return new NetworkIndexTile();
	}

}

// # NetworkIndexTile
// Class for representing a tile in the network index.
class NetworkIndexTile {
	nr = 0;
	pointer: Pointer | null = null;
	blocks: any[];
	automata: any[];
	reps: Uint8Array[] = [
		new Uint8Array(12),
		new Uint8Array(12),
		new Uint8Array(12),
		new Uint8Array(12),
	];
	reps2: any[] = [];
	u = new Unknown()
		.byte(0x00)
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x00000000)
		.word(0x0000);

	// ## parse(rs)
	parse(rs: Stream) {
		let u = this.u.reader(rs);
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
		u.byte();
		u.dword();
		u.dword();
		u.dword();
		this.reps = [];
		for (let i = 0; i < 4; i++) {
			this.reps.push(rs.read(12));
		}

		u.word();

		// Next follows an array where each record counts 10 bytes.
		this.reps2 = rs.array(() => {
			return {
				nr: rs.dword(),
				bytes: rs.read(6),
			};
		});

	}

	// ## write(ws)
	write(ws: WriteBuffer) {
		let u = this.u.writer(ws);
		ws.dword(this.nr);
		ws.pointer(this.pointer);
		ws.array(this.blocks, block => {
			ws.dword(block.nr);
			ws.array(block.bytes, bytes => ws.write(bytes as Uint8Array));
		});
		ws.array(this.automata, ptr => ws.pointer(ptr));
		u.byte();
		u.dword();
		u.dword();
		u.dword();
		for (let rep of this.reps) {
			ws.write(rep);
		}
		u.word();
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
	pointer: Pointer | null = null;
	west: any = null;
	north: any = null;
	east: any = null;
	south: any = null;
	u = new Unknown()
		.byte(0x00)
		.dword(0x00000000);

	// ## parse(rs)
	parse(rs: Stream) {
		const u = this.u.reader(rs);
		this.pointer = rs.pointer();
		u.byte();
		u.dword();
		for (let dir of ['west', 'north', 'east', 'south'] as Dirs[]) {

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
	write(ws: WriteBuffer) {
		let u = this.u.writer(ws);
		ws.pointer(this.pointer);
		u.byte();
		u.dword();
		for (let dir of ['west', 'north', 'east', 'south'] as Dirs[]) {
			let { array, bool } = this[dir];
			let { length } = array.filter(({ ignore }: { ignore: boolean }) => !ignore);
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
	x: word = 0x0000;
	z: word = 0x0000;
	dword: dword = 0x00000000;
	pointer: Pointer | null = null;

	// ## parse(rs)
	parse(rs: Stream) {
		this.z = rs.word();
		this.x = rs.word();
		this.dword = rs.dword();
		this.pointer = rs.pointer();
	}

	// ## write(ws)
	write(ws: WriteBuffer) {
		ws.word(this.z);
		ws.word(this.x);
		ws.dword(this.dword);
		ws.pointer(this.pointer);
	}

}

// # ComplexIntersection
// The class for representing complex Y intersections in the network index. 
// They are not fully understood yet though.
type Dirs = keyof ComplexIntersection & keyof NetworkIntersection & ('west' | 'north' | 'east' | 'south');
type DirType = {
	array: dword[];
	word: word;
};

class ComplexIntersection {
	pointer: Pointer | null = null;
	west: DirType | null = null;
	north: DirType | null = null;
	east: DirType | null = null;
	south: DirType | null = null;

	// ## parse(rs)
	parse(rs: Stream) {
		this.pointer = rs.pointer();
		for (let dir of ['west', 'north', 'east', 'south'] as Dirs[]) {
			this[dir] = {
				array: rs.array(() => rs.dword()),
				word: rs.word(),
			};
		}
	}

	// ## write(ws)
	write(ws: WriteBuffer) {
		ws.pointer(this.pointer);
		for (let dir of ['west', 'north', 'east', 'south'] as Dirs[]) {
			let struct = this[dir] as DirType;
			ws.array(struct.array, dword => ws.dword(dword));
			ws.word(struct.word);
		}
	}

}
