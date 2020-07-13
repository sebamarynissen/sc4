// # street-map.js
'use strict';

// The different network types that we'll support.
const STREET = 1;
const ROAD = 2;
const AVENUE = 3;

// # StreetMap
// A class that represents the roads and streets within a city. It's basically 
// a 2D array where every tile can be occupied by a certain network type 
// (street, road, avenue, ...) with some additional features. We can use this 
// to generate a city from.
class StreetMap extends Array {

	// ## constructor(m, n = m)
	constructor(m = 64, n = m) {
		super(n);
		for (let x = 0; x < n; x++) {
			this[x] = new Array(m).fill(0);
		}
	}

	// ## tile(x, z, type)
	// Creates a tile at the position [x, z] of the given type, provided that 
	// we don't override a network tile of a *higher* type. You probably won't 
	// use this method directly but use the `street()`, `road()` methods 
	// instead.
	tile(x, z, type = STREET) {
		let tile = this[x][z];
		if (type > tile) {
			this[x][z] = type;
		}
		return this;
	}

	// ## street(x, z)
	// Adds a street tile at [x, z].
	street(x, z) {
		return this.tile(x, z, STREET);
	}

	// ## road(x, z)
	// Adds a road tile at [x, z]
	road(x, z) {
		return this.tile(x, z, ROAD);
	}

	// ## avenue(x, z)
	// Adds an avenue tile at [x, z]. Note that avenue is merely a convention 
	// of priority. It doesn't take into account that it's a 2-tile network in 
	// the game. You'll have to do this manually.
	avenue(x, z) {
		return this.tile(x, z, AVENUE);
	}

	// ## draw(P, Q, type)
	// Draws a network type from P to Q. Note that this can only draw 
	// orthogonally for now!
	draw(P, Q, type = STREET) {
		let d = [
			Q[0] - P[0],
			Q[1] - P[1],
		];
		if (d[0] !== 0 && d[1] !== 0) {
			throw new Error('Cannot draw non-straight lines!');
		}

		// Now ensure we go in the correct direction.
		if (d[0] === 0) {
			let x = P[0];
			let a = Math.min(P[1], Q[1]);
			let b = Math.max(P[1], Q[1]);
			for (let z = a; z <= b; z++) {
				this.tile(x, z, type);
			}
		} else {
			let z = P[1];
			let a = Math.min(P[0], Q[0]);
			let b = Math.max(P[0], Q[0]);
			for (let x = a; x <= b; x++) {
				this.tile(x, z, type);
			}
		}
		return this;
	}

	// ## drawStreet(P, Q)
	drawStreet(P, Q) {
		return this.draw(P, Q, STREET);
	}

	// ## drawRoad(P, Q)
	drawRoad(P, Q) {
		return this.draw(P, Q, ROAD);
	}

	// ## drawAvenue(P, Q)
	drawAvenue(P, Q) {
		return this.draw(P, Q, AVENUE);
	}

}
module.exports = StreetMap;
