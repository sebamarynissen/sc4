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
	constructor(xSize, ySize) {
		super();
		this.major = 0x0002;
		this.xSize = xSize*64+1;
		this.ySize = ySize*64+1;
	}

	// ## parse(buff)
	// Parsing the terrain map is a bit special because the size is not 
	// specified explicitly in the buffer. It is stored somewhere else in the 
	// file, but we can determine it from  the buffer size as well.
	parse(buff) {

		// Determine the size based on the buffer length alone.
		this.xSize = Math.sqrt((buff.length-2)/4);
		this.ySize = this.xSize;
		this.length = this.xSize;

		// Next read in all the values.
		let rs = new Stream(buff);
		this.major = rs.word();
		for (let x = 0; x < this.xSize; x++) {
			let arr = this[x] = new Float32Array(this.ySize);
			for (let y = 0; y < this.ySize; y++) {
				arr[y] = rs.float();
			}
		}

	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.word(this.major);
		for (let x = 0; x < this.xSize; x++) {
			for (let y = 0; y < this.ySize; y++) {
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
