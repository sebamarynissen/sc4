// # zone-developer-file.js
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';
import type Pointer from './pointer.js';
import type Stream from './stream.js';

// # ZoneDeveloperFile
export default class ZoneDeveloperFile {

	static [kFileType] = FileType.ZoneDeveloperFile;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0001;
	xSize = 0x00000040;
	zSize = 0x00000040;
	cells: Pointer[][] = [];

	// ## parse(rs)
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.xSize = rs.dword();
		this.zSize = rs.dword();

		// Read in the cell values. Note that we read data downwards, so first 
		// [0,0], then [0,1], then [0, 2], ... The cells should reflect this!
		let cells = this.cells = new Array(this.xSize);
		for (let x = 0; x < this.xSize; x++) {
			let column = cells[x] = new Array(this.zSize);
			for (let z = 0; z < this.zSize; z++) {
				column[z] = rs.pointer();
			}
		}
		rs.assert();

		// Done.
		return this;

	}

	// ## isOccupied(x, z)
	// Returns whether the tile (x, z) is currently occupied. Note that we'll 
	// also consider a tile as occupied if it's outside the boundaries.
	isOccupied(x: number, z: number) {
		const { cells } = this;
		if (x >= cells.length || x < 0) return true;
		const col = cells[x];
		if (z >= col.length || z < 0) return true;
		return col[z] !== null;
	}

	// ## clear()
	// Clears the entire zone developer file, meaning we set all pointers back 
	// to "null".
	clear() {
		for (let row of this.cells) {
			row.fill(null);
		}
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.xSize);
		ws.dword(this.zSize);
		for (let cell of this) {
			ws.pointer(cell);
		}
		return ws.seal();
	}

	// ## *[Symbol.iterator]
	// Allows the file to be used as iterator. We'll yield all cells in 
	// z-order first.
	*[Symbol.iterator]() {
		let cells = this.cells;
		for (let x = 0; x < this.xSize; x++) {
			for (let z = 0; z < this.zSize; z++) {
				yield cells[x][z];
			}
		}
	}

}
