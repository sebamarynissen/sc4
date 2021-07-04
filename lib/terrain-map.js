// # terrain-map.js
'use strict';
const Stream = require('./stream');
const WriteBuffer = require('sc4/lib/write-buffer.js');
const Type = require('./type.js');
const { FileType } = require('./enums.js');

// Width of a single tile in meters.
const TILE_WIDTH = 16;

// # TerrainMap
// The class we use for representing the terrain in a city.
class TerrainMap extends Array {

	// ## constructor(xSize, ySize)
	constructor(xSize = 0, ySize = xSize) {
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

	// ## query(x, y, cliff)
	// Performs a terrain query using interpolation. This means that the 
	// coordinates are given in *meters*, not in tiles! Note that the game 
	// normally triangulates from north-west to south-east, but this is 
	// changed for cliffs. People often use the diagonally jagged edges mod 
	// which alters when the game treats a slope as a cliff. Hence this value 
	// can be specified as an option as it determines how to interpolate as 
	// well!
	query(x, y, cliff) {
		
		// Find the tile numbers and local coordinates first.
		let i = Math.floor(x/TILE_WIDTH);
		let j = Math.floor(y/TILE_WIDTH);
		let xx = (x - TILE_WIDTH*i) / TILE_WIDTH;
		let yy = (y - TILE_WIDTH*j) / TILE_WIDTH;

		// Handle the normal, non-cliff case where we need to find the right 
		// triangle for interpolation.
		let P = [0, 0, this[i][j]];
		let Q = [1, 1, this[i+1][j+1]];
		let R = xx > yy ? [1, 0, this[i+1][j]] : [0, 1, this[i][j+1]];
		return ipol(P, Q, R, [xx, yy]);

	}

}
module.exports = TerrainMap;

// # ipol(P, Q, R, [x, y])
// Helper function for triangular interpolation. It accepts three points and 
// finds the equation of the plane going to those three points.
function ipol(P, Q, R, [x, y]) {
	let u = [Q[0]-P[0], Q[1]-P[1], Q[2]-P[2]];
	let v = [R[0]-P[0], R[1]-P[1], R[2]-P[2]];
	let a = u[1]*v[2] - u[2]*v[1];
	let b = u[2]*v[0] - u[0]*v[2];
	let c = u[0]*v[1] - u[1]*v[0];
	let d = P[0]*a + P[1]*b + P[2]*c;
	return (d - a*x - b*y)/c;
}
