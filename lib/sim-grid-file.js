// # sim-grid.js
"use strict";
const bsearch = require('binary-search-bounds');
const Stream = require('./stream');
const WriteBuffer = require('./write-buffer.js');
const { chunk } = require('./util');

const TypedArrays = {
	0x49b9e602: Uint8Array,
	0x49b9e603: Int8Array,
	0x49b9e604: Uint16Array,
	0x49b9e605: Int16Array,
	0x49b9e606: Uint32Array,
	0x49b9e60a: Float32Array,
};
const Readers = {
	0x49b9e602: Stream.prototype.uint8,
	0x49b9e603: Stream.prototype.int8,
	0x49b9e604: Stream.prototype.uint16,
	0x49b9e605: Stream.prototype.int16,
	0x49b9e606: Stream.prototype.uint32,
	0x49b9e60a: Stream.prototype.float,
};

// # SimGridFile
// The class representing a SimGrid file (could be any of the different types, 
// general structure is the same anyway). It holds several sim grids 
// internally.
class SimGridFile {

	// ## constructor()
	constructor() {
		this.grids = [];
		this.sorted = [];
	}

	// ## parse(buff)
	parse(buff) {
		let rs = new Stream(buff);
		let grids = this.grids;
		grids.length = 0;
		while (!rs.eof()) {
			let grid = new SimGrid();
			grid.parse(rs);
			grids.push(grid);
		}

		// Now sort by data id so that we're able to find them again easily.
		this.sorted = this.grids.map(x => x).sort(compare);

	}

	// ## *[Symbol.iterator]
	*[Symbol.iterator]() {
		yield* this.grids;
	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(this.grids.map(grid => grid.toBuffer()));
	}

	// ## get(dataId)
	// Returns the grid for the given data Id.
	get(dataId) {
		let index = bsearch.eq(this.sorted, { dataId }, compare);
		return index > -1 ? this.sorted[index] : null;
	}

}
module.exports = SimGridFile;

// Comparator function used to sort grids.
function compare(a, b) {
	return a.dataId - b.dataId;
}

// # SimGrid
const SimGrid = SimGridFile.SimGrid = class SimGrid {

	// SimCity 4 has different classes for each simgrid, but we just have 1 
	// class for all data types. Still it might be useful to access the type for 
	// pointers, so we need to make the sc4.type accessible as well, but not as 
	// a static property this time!
	get [Symbol.for('sc4.type')]() { return this.type; }

	// ## constructor()
	constructor() {

		// Note: I think some of the unknowns identifies the data type, where 
		// 0x01 is UInt8 etc. Not sure though, we should investigate this 
		// deeper.
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0001;
		this.u1 = 0x01;
		this.type = 0x00000000;
		this.dataId = 0x00000000;
		this.resolution = 0x00000001;
		this.resolutionPower = 0x00000000;
		this.xSize = 0x00000040;
		this.zSize = 0x00000040;
		this.u6 = 0x00000000;
		this.u7 = 0x00000000;
		this.u8 = 0x00000000;
		this.u9 = 0x00000000;
		this.data = null;
	}

	// ## parse(rs)
	parse(rs) {
		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.u1 = rs.byte();
		this.type = rs.dword();
		this.dataId = rs.dword();
		this.resolution = rs.dword();
		this.resolutionPower = rs.dword();
		this.xSize = rs.dword();
		this.zSize = rs.dword();
		this.u6 = rs.dword();
		this.u7 = rs.dword();
		this.u8 = rs.dword();
		this.u9 = rs.dword();

		// Don't know if multiple values are possible here, the SInt8 does 
		// some pretty weird stuff... Anyway, for now we'll just read in the 
		// rest into the appropriate underlying array type.
		// Note: we could directly copy the arraybuffer, but it's pretty error 
		// prone apparently, especially with the offsets and stuff. Hence 
		// we'll write in manually.
		const Typed = TypedArrays[ this.type ];
		const reader = Readers[ this.type ];
		const count = this.xSize * this.zSize;
		let data = this.data = new Typed(count);
		for (let i = 0; i < count; i++) {
			data[i] = reader.call(rs);
		}

		// Ensure that we've read everything correctly.
		let diff = rs.i - start;
		if (diff !== size) {
			console.warn([
				'Error while reading SimGrid!',
				`Expected ${size} bytes, but read ${diff}!`,
			]);
		}

		// Done! Easy data access is available by calling createProxy(). Using 
		// this it's possible to access the data as if it were a 
		// multidimensional array.
		return this;

	}

	// ## toBuffer()
	toBuffer() {

		// Pre-allocate the header.
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.byte(this.u1);
		ws.dword(this.type);
		ws.dword(this.dataId);
		ws.dword(this.resolution);
		ws.dword(this.resolutionPower);
		ws.dword(this.xSize);
		ws.dword(this.zSize);
		ws.dword(this.u6);
		ws.dword(this.u7);
		ws.dword(this.u8);
		ws.dword(this.u9);

		// Use the underlying buffer of our data view. At least on LE systems 
		// this should be good to be used directly.
		let data = Buffer.from(this.data.buffer);
		ws.write(data);
		return ws.seal();

	}

	// ## get(x, z)
	// Returns the value stored in cell (x, z)
	get(x, z) {
		let { zSize } = this;
		return this.data[ x*zSize + z ];
	}

	// ## set(x, z)
	// Sets the value stored in cell (x, z)
	set(x, z, value) {
		this.data[ x*this.zSize+z ] = value;
		return this;
	}

	// ## createProxy()
	// Creates a data proxy so that we can access the data in an array-like 
	// way.
	createProxy() {
		return new Proxy(this, {
			get(target, prop, receiver) {
				let x = +prop;
				return new Proxy(target, {
					get(target, prop, receiver) {
						let z = +prop;
						let { zSize, data} = target;
						return data[ x*zSize + z];
					}
				});
			}
		});
	}

	// ## paint()
	// Creates a visual representation of the sim grid on a canvas. Of course 
	// this can only be used in HTML environments that properly support canvas!
	paint() {
		let canvas = document.createElement('canvas');
		canvas.width = this.xSize;
		canvas.height = this.zSize;

		// Find the max value in the data.
		const data = this.data;
		let max = Math.max(...data);
		if (max === 0) max = 1;

		// Create a canvas context.
		let ctx = canvas.getContext('2d');
		let imgData = ctx.createImageData(canvas.width, canvas.height);

		// Fill up the image data. Note that we have to flip unfortunately, 
		// but that's manageable.
		for (let z = 0; z < this.zSize; z++) {
			for (let x = 0; x < this.xSize; x++) {
				let value = data[ x*this.zSize+z ];
				let offset = 4*(z*this.xSize+x);
				let alpha = (value / max)*0xff;
				imgData.data[offset+3] = alpha;
			}
		}
		ctx.putImageData(imgData, 0, 0);

		return canvas;

	}

}