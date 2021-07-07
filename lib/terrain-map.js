// # terrain-map.js
'use strict';
const Stream = require('./stream');
const WriteBuffer = require('sc4/lib/write-buffer.js');
const Type = require('./type.js');
const { FileType } = require('./enums.js');

// Width of a single tile in meters.
const TILE_WIDTH = 16;

// # TerrainMap
// The class we use for representing the terrain in a city. Note that we 
// follow the convention of the game, so we use x and z coordinates. The y 
// coordinate represents the height!
class TerrainMap extends Array {

	// ## constructor(xSize, zSize)
	constructor(xSize = 0, zSize = xSize) {
		super();
		this.major = 0x0002;
		this.xSize = xSize+1;
		this.zSize = zSize+1;
		Object.defineProperty(this, 'raw', {
			writable: true,
			value: null,
		});
		this.fill();
	}

	// ## clone()
	// Returns a clone of the terrain map where you can make modifications 
	// with affecting the original terrain map. It's useful for doing network 
	// egalization calculations before *actually* flattening the terrain.
	clone() {
		let clone = new TerrainMap(this.xSize-1, this.zSize-1);
		clone.raw.set(this.raw);
		return clone;
	}

	// ## fill()
	// Method used internally to initialze the terrain map based on the 
	// current size. Note that internally we use a single *flat* array, so 
	// we'll create typed views on top of it.
	fill() {
		let raw = this.raw = new Float32Array(this.zSize*this.xSize);
		for (let z = 0; z < this.zSize; z++) {
			this[z] = new Float32Array(
				raw.buffer,
				z*Float32Array.BYTES_PER_ELEMENT*this.xSize,
				this.xSize,
			);
		}
	}

	// ## parse(buff)
	// Parsing the terrain map is a bit special because the size is not 
	// specified explicitly in the buffer. It is stored somewhere else in the 
	// file, but we can determine it from the buffer size as well.
	parse(buff) {

		// Determine the size based on the buffer length alone.
		this.xSize = this.zSize = Math.sqrt((buff.length-2)/4);
		this.fill();

		// Now actually read in all the values, in their natural order. This 
		// means that if you want to access values, you need to specify z 
		// first, then x!
		let rs = new Stream(buff);
		this.major = rs.word();
		for (let i = 0; i < this.raw.length; i++) {
			this.raw[i] = rs.float();
		}

	}

	// ## toBuffer()
	// When serializing the terrain map back to a buffer, we need to take into 
	// account it's *row first*!
	toBuffer() {
		let ws = new WriteBuffer();
		ws.word(this.major);
		for (let i = 0; i < this.raw.length; i++) {
			ws.float(this.raw[i]);
		}
		return ws.toBuffer();
	}

	// ## get(i, j)
	get(i, j) {
		return this[j][i];
	}

	// ## set(i, j, h)
	set(i, j, h) {
		this[j][i] = h;
		return this;
	}

	// ## isCliff(x, z, cliff = 0.5)
	// Internal helper function that checks if the given tile is to be 
	// considered as a cliff, meaning we need to flip the triangulation.
	isCliff(x, z, cliff = 0.5) {
		let P = [0, this[z][x], 0];
		let Q = [TILE_WIDTH, this[z][x+1], 0];
		let R = [0, this[z+1][x], TILE_WIDTH];
		let S = [TILE_WIDTH, this[z+1][x+1], TILE_WIDTH];
		let n1 = normal(P, Q, S);
		let n2 = normal(P, S, R);
		let yy1 = (n1[1]**2)/sql(n1)
		let yy2 = (n2[1]**2)/sql(n2);
		return Math.max(yy1, yy2) < cliff;
	}

	// ## query(x, z, cliff = 0.5)
	// Performs a terrain query using interpolation. This means that the 
	// coordinates are given in *meters*, not in tiles! Note that the game 
	// normally triangulates from north-west to south-east, but this is 
	// changed for cliffs. The cliff threshold can be modded though, so we 
	// allow this to be specified as a parameter which defaults to 0.5 (it's 
	// the maxNormalYForCliff) value.
	query(x, z, cliff = 0.5) {
		
		// Find the tile numbers and local coordinates first.
		let i = Math.floor(x/TILE_WIDTH);
		let j = Math.floor(z/TILE_WIDTH);
		let t = (x - TILE_WIDTH*i) / TILE_WIDTH;
		let s = (z - TILE_WIDTH*j) / TILE_WIDTH;

		// Important! If the point lies exactly on an edge, we need to 
		// interpolate the edge. Otherwise we might risking interpolating on a 
		// non-existent tile!
		if (t === 0 && s === 0) {
			return this[j][i];
		} else if (t === 0) {
			return (1-s)*this[j][i] + s*this[j+1][i];
		} else if (s === 0) {
			return (1-t)*this[j][i] + t*this[j][i+1];
		}

		// First of all we'll determine the three "normal" points in case we 
		// don't need to alter for cliffs.
		if (!this.isCliff(i, j, cliff)) {
			let P = [0, 0, this[j][i]];
			let Q = [1, 1, this[j+1][i+1]];
			let R = t > s ? [1, 0, this[j][i+1]] : [0, 1, this[j+1][i]];
			return ipol(P, Q, R, [t, s]);
		} else {
			let P = [1, 0, this[j][i+1]];
			let Q = [0, 1, this[j+1][i]];
			let R = t > 1-s ? [1, 1, [this[j+1][i+1]]] : [0, 0, this[j][i]];
			return ipol(P, Q, R, [t, s]);
		}

	}

}
module.exports = TerrainMap;

// # normal(P, Q, R)
// Calculates the normal vector for the plane going through the given three 
// points.
function normal(P, Q, R) {
	let u = [Q[0]-P[0], Q[1]-P[1], Q[2]-P[2]];
	let v = [R[0]-P[0], R[1]-P[1], R[2]-P[2]];
	let a = u[2]*v[1] - u[1]*v[2];
	let b = u[0]*v[2] - u[2]*v[0];
	let c = u[1]*v[0] - u[0]*v[1];
	return [a, b, c];
}

// # sql(v)
// Finds the *squared* length of the given vector
function sql(v) {
	return v[0]**2 + v[1]**2 + v[2]**2;
}

// # ipol(P, Q, R, [x, z])
// Helper function for triangular interpolation. It accepts three points and 
// finds the equation of the plane going to those three points.
function ipol(P, Q, R, [x, z]) {
	let [a, b, c] = normal(P, Q, R);
	let d = P[0]*a + P[1]*b + P[2]*c;
	return (d - a*x - b*z)/c;
}
