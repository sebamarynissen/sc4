// # terrain-map.js
"use strict";
const Stream = require('./stream');

// # TerrainMap
class TerrainMap {

	// ## constructor(xSize, ySize)
	constructor(xSize, ySize) {
		this.major = 0x0002;
		this.xSize = xSize*64+1;
		this.ySize = ySize*64+1;
		this.map = [];
	}

	// ## parse(buff)
	parse(buff) {

		let rs = new Stream(buff);
		this.major = rs.word();
		let map = this.map = new Array(this.xSize);
		for (let x = 0; x < this.xSize; x++) {
			let arr = map[x] = new Float32Array(this.ySize);
			for (let y = 0; y < this.ySize; y++) {
				arr[y] = rs.float();
			}
		}

	}

	// ## get(x,y)
	get(x,y) {
		return this.map[x][y];
	}

}
module.exports = TerrainMap;