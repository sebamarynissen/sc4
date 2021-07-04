// # terrain-map.js
'use strict';
const Stream = require('./stream');
const WriteBuffer = require('sc4/lib/write-buffer.js');
const Type = require('./type.js');
const { FileType } = require('./enums.js');

// # TerrainMap
// The class we use for representing the terrain in a city.
class TerrainMap extends Array {

	// ## constructor(xSize, ySize)
	constructor(xSize = 0, ySize = 0) {
		super();
		this.major = 0x0002;
		this.xSize = xSize*64+1;
		this.ySize = ySize*64+1;
		this.fill();
	}

	// ## fill()
	// Method used internally to initialze the terrain map based on the 
	// currently. We do this row-first so that the individual values can be 
	// easily accessed using [x][y] queries.
	fill() {
		this.length = this.xSize;
		for (let x = 0; x < this.xSize; x++) {
			this[x] = new Float32Array(this.ySize);
		}
	}

	// ## parse(buff)
	// Parsing the terrain map is a bit special because the size is not 
	// specified explicitly in the buffer. It is stored somewhere else in the 
	// file, but we can determine it from the buffer size as well.
	parse(buff) {

		// Determine the size based on the buffer length alone.
		this.xSize = this.ySize = Math.sqrt((buff.length-2)/4);
		this.fill();

		// Now actually read in all the values, *row first*.
		let rs = new Stream(buff);
		this.major = rs.word();
		for (let y = 0; y < this.ySize; y++) {
			for (let x = 0; x < this.xSize; x++) {
				this[x][y] = rs.float();
			}
		}

	}

	// ## toBuffer()
	// When serializing the terrain map back to a buffer, we need to take into 
	// account it's *row first*!
	toBuffer() {
		let ws = new WriteBuffer();
		ws.word(this.major);
		for (let y = 0; y < this.ySize; y++) {
			for (let x = 0; x < this.xSize; x++) {
				ws.float(this[x][y]);
			}
		}
		return ws.toBuffer();
	}

	// ## get(x, y)
	get(x, y) {
		return this.this[x][y];
	}

}
module.exports = TerrainMap;
