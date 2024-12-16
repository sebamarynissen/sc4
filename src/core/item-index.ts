// # item-index-file.js
import WriteBuffer from './write-buffer.js';
import Pointer from './pointer.js';
import { FileType } from './enums.js';
import { getClassType } from './helpers.js';
import { kFileType } from './symbols.js';
import type { SavegameObject } from './types.js';
import type Stream from './stream.js';

const SIZE = 192;
type CitySize = 1024 | 2048 | 4096;
type TractSize = 16 | 32 | 64;
type TileSize = 64 | 128 | 256;

// # ItemIndex
export default class ItemIndex {
	static [kFileType] = FileType.ItemIndex;

	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0001;
	width: CitySize = 1024;
	depth: CitySize = 1024;
	tractWidth: TractSize = 16;
	tractDepth: TractSize = 16;
	tileWidth: TileSize = 64;
	tileDepth: TileSize = 64;
	elements: Cell[][] = [];

	// Array-like functionality.
	get length() { return this.elements.length; }
	set length(length: number) { this.elements.length = length; }
	*[Symbol.iterator]() { yield* this.elements; }

	// ## constructor(x, z)
	// Creates the item index. You can specify a size *in tracts* to set up 
	// the item index more easily. 16 tracts is a small city, 32 medium and 64 
	// is large.
	constructor(x: TractSize = 0x10, z: TractSize = x) {
		this.width = 64*x as CitySize;
		this.depth = 64*z as CitySize;
		this.tractWidth = x;
		this.tractDepth = z;
		this.tileWidth = 4*x as TileSize;
		this.tileDepth = 4*z as TileSize;
	}

	// ## get(x: number, z: number)
	get(x: number, z: number): Cell | undefined {
		let column = this.elements[x];
		if (!column) return undefined;
		return column.at(z);
	}

	// ## fill()
	// Fills up the item index with cells. This is useful when not parsing an 
	// item index, but generating a city from scratch where you need an empty 
	// item index.
	fill(): this {
		let { elements } = this;
		elements.length = SIZE;
		for (let x = 0; x < elements.length; x++) {
			let column = elements[x] = new Array(SIZE) as Cell[];
			for (let z = 0; z < column.length; z++) {
				column[z] = new Cell(x, z);
			}
		}
		return this;
	}

	// ## rebuild(type, file)
	// Rebuilds the index so that it puts all entries of the given file in 
	// their correct tracts.
	rebuild(type: number, file: SavegameObject[]) {

		// From now on we need a specific file type because certain arrays might 
		// be empty, in which case we don't know what type of values the array 
		// holds. That's because we now use bare arrays instead of extensions of 
		// native arrays!
		if (!type) {
			throw new Error(`Unknown file type! ${type}`);
		}

		// First of all we'll remove all references to the give file type. 
		// Note that it would be useful if we could use cell.filter somehow, 
		// but it's not possible for now unfortunately so we need to use 
		// slice...
		this.filter(pointer => pointer.type !== type);

		// Now loop all records from the file and insert into the correct 
		// cells.
		for (let record of file) {
			let { mem } = record;
			for (let x = record.xMinTract; x <= record.xMaxTract; x++) {
				for (let z = record.zMinTract; z <= record.zMaxTract; z++) {
					this.elements[x][z].push(new Pointer(type, mem));
				}
			}
		}
		return this;
	}

	// ## filter(fn)
	// Helper method for filtering all cells in the item index.
	filter(...params: Parameters<Cell['filter']>): this {
		for (let row of this) {
			for (let cell of row) {
				cell.filter(...params);
			}
		}
		return this;
	}

	// ## clear()
	clear() {
		this.fill();
	}

	// ## add(item, type)
	// Adds the given item to the item index. We'll try to figure out the type 
	// automatically, but you can specify it yourself as well. Note that the 
	// item needs to expose min and max tract coordinates, but they do so 
	// quite often!
	add(item: SavegameObject, type = getClassType(item)) {
		for (let x = item.xMinTract; x <= item.xMaxTract; x++) {
			for (let z = item.zMinTract; z <= item.zMaxTract; z++) {
				this.elements[x][z].push(new Pointer(type, item.mem));
			}
		}
	}

	// ## parse(rs)
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.width = rs.float() as CitySize;
		this.depth = rs.float() as CitySize;
		this.tractWidth = rs.dword() as TractSize;
		this.tractDepth = rs.dword() as TractSize;
		this.tileWidth = rs.dword() as TileSize;
		this.tileDepth = rs.dword() as TileSize;
 
		let columns = rs.dword();
		this.length = columns;
		for (let x = 0; x < columns; x++) {
			let rows = rs.dword();
			let column = new Array(rows);
			this.elements[x] = column;
			for (let z = 0; z < rows; z++) {
				let count = rs.dword();
				let cell = new Cell(x, z);
				column[z] = cell;
				for (let i = 0; i < count; i++) {
					let ptr = rs.pointer();
					if (ptr === null) continue;
					cell.push(ptr);
				}
			}
		}

		// Check if we've read everything correctly.
		rs.assert();
		return this;

	}

	// ## toBuffer()
	// Serializes the item index into a binary buffer.
	// Generator function that will yield buffer chunks. Note that we can only 
	// ever yield 1 buffer chunk because we need to calculate its checksum and 
	// we need the entire buffer for this!
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.float(this.width);
		ws.float(this.depth);
		ws.dword(this.tractWidth);
		ws.dword(this.tractDepth);
		ws.dword(this.tileWidth);
		ws.dword(this.tileDepth);
		ws.dword(this.length);

		// Write all cells.
		for (let column of this) {
			ws.dword(column.length);
			for (let cell of column) {
				ws.dword(cell.length);
				for (let ptr of cell) {
					ws.pointer(ptr);
				}
			}
		}
		return ws.seal();

	}

	// ## *flat()
	// Returns an iterator that iterates over every cell, instead of row by row. 
	// Note that we might want to do make this the default iterator by the way!
	*flat() {
		for (let column of this) {
			for (let cell of column) {
				yield cell;
			}
		}
	}

}

// # Cell
// Tiny class for representing a cell within the item index.
class Cell extends Array<Pointer> {
	x = 0;
	z = 0;
	constructor(x = 0, z = 0) {
		super();
		this.x = x;
		this.z = z;
	}

	// ## filter(fn)
	// Overrides the native array filter function to filter the cell *in 
	// place*, which is useful because we don't replace cells in the item 
	// index!
	filter(
		fn: (ptr: Pointer, index: number, cell: Cell) => boolean,
	): this {

		// We'll first collect all the indices that need to be removed.
		const { length } = this;
		let indices = [];
		for (let i = 0; i < length; i++) {
			if (!fn(this[i], i, this)) {
				indices.push(i);
			}
		}

		// Next we'll actually remove the indices, but we take into account 
		// that the array's length is modified in the meantime!
		for (let i = 0; i < indices.length; i++) {
			let index = indices[i]-i;
			this.splice(index, 1);
		}

		// Done!
		return this;

	}

}
