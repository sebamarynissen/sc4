// # zone-developer-file.js
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';

// # ZoneDeveloperFile
export default class ZoneDeveloperFile {

	static [Symbol.for('sc4.type')] = FileType.ZoneDeveloperFile;

	// ## constructor()
	constructor() {
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0001;
		this.xSize = 0x00000040;
		this.zSize = 0x00000040;
		this.cells = [];
	}

	// ## parse(buff, opts)
	parse(buff, opts) {

		let rs = new Stream(buff);
		let size = rs.dword();
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

		if (rs.i !== size) {
			console.warn([
				'Error when reading the ZoneDeveloperFile!',
				`Expected ${size} bytes, but read ${rs.i}!`,
			].join(' '));
		}

		// Done.
		return this;

	}

	// ## isOccupied(x, z)
	// Returns whether the tile (x, z) is currently occupied. Note that we'll 
	// also consider a tile as occupied if it's outside the boundaries.
	isOccupied(x, z) {
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

	// ## toBuffer(opts)
	toBuffer(opts) {
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
