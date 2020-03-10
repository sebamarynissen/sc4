// # item-index-file.js
"use strict";
const deprecate = require('util-deprecate');
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const { FileType } = require('./enums');
const crc32 = require('./crc');
const { ArrayType } = require('./type');

// # ItemIndex
class ItemIndex extends ArrayType(FileType.ItemIndexFile) {

	// ## constructor()
	constructor() {
		super(0);
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0001;
		this.width = 1024;
		this.depth = 1024;
		this.tractWidth = 0x00000010;
		this.tractDepth = 0x00000010;
		this.tileWidth = 0x00000040;
		this.tileDepth = 0x00000040;
	}

	// ## rebuild(file)
	// Rebuilds the index so that it puts all entries of the given file in 
	// their correct tracts.
	rebuild(file) {
		let type = file.type;
		if (!type) throw new Error('Unknown file type!');
		for (let record of file) {
			let mem = record.mem;
			for (let cell of this) {

				// Check for the record in the cell.
				let index = cell.findIndex(entry => entry.mem === mem);
				if (!(index > -1)) continue;

				// Ok, entry was found in the cell. Remove it. We'll add it later on.
				cell.splice(index, 1);

			}

			// Now, add the record to the appropriate cells.
			for (let x = record.xMinTract; x <= record.xMaxTract; x++) {
				for (let z = record.zMinTract; z <= record.zMaxTract; z++) {
					let cell = this[x][z];
					cell.push({"mem": mem, "type": type});
				}
			}

		}
	}

	// ## parse(buff)
	parse(buff) {

		let rs = new Stream(buff);
		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.width = rs.float();
		this.depth = rs.float();
		this.tractWidth = rs.dword();
		this.tractDepth = rs.dword();
		this.tileWidth = rs.dword();
		this.tileDepth = rs.dword();

		let columns = rs.dword();
		this.length = columns;
		for (let x = 0; x < columns; x++) {
			let rows = rs.dword();
			let column = new Array(rows);
			this[x] = column;
			for (let z = 0; z < rows; z++) {
				let count = rs.dword();
				let cell = new Array(count);
				cell.x = x;
				cell.z = z;
				column[z] = cell;
				for (let i = 0; i < count; i++) {
					let mem = rs.dword();
					let type = rs.dword();
					cell[i] = {mem, type};
				}
			}
		}

		// Check if we've read everything correctly.
		let diff = rs.i - start;
		if (diff !== size) {
			console.warn([
				'Error when reading Item Index File',
				`Expected ${size} bytes, but read ${diff}!`
			]);
			rs.jump(start + size);
		}

		return this;

	}

	// ## *flat()
	// Returns an iterator so that all cells can be iterated over easily at 
	// once, not on a per row basis, which is the normal iterator behavior.
	*flat() {
		for (let column of this) {
			for (let cell of column) {
				yield cell;
			}
		}
	}

	// ## *bgen(opts)
	// Generator function that will yield buffer chunks. Note that we can only 
	// ever yield 1 buffer chunk because we need to calculate its checksum and 
	// we need the entire buffer for this!
	*bgen(opts) {

		// Calculate the size of the buffer.
		let size = 42;
		for (let column of this) {

			// Add 4 bytes because for each column we need to store the amount 
			// of rows as a dword.
			size += 4;
			for (let cell of column) {

				// 4 bytes because for each cell we need to store the amount 
				// of items as a dword and then 8 bytes per item.
				size += 4 + 8*cell.length;

			}
		}
		let buff = Buffer.allocUnsafe(size);
		let ws = new WriteStream(buff);
		ws.dword(size);
		ws.jump(8);

		// Write the header.
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
				for (let item of cell) {
					ws.dword(item.mem);
					ws.dword(item.type);
				}
			}
		}

		// Now calculate the cheksum.
		buff.writeUInt32LE(crc32(buff, 8), 4);

		yield buff;

	}

}

// Give access to the "columns" filed for legacy purposes, but deprecate it.
Object.defineProperty(ItemIndex.prototype, 'columns', {
	"get": deprecate(function() {
		return this;
	}, '.columns is deprecated, use as normal array instead')
});

module.exports = ItemIndex;