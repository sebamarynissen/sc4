// # matrix.js
// # Matrix
// Class for representing a transformation matrix.
export default class Matrix extends Float32Array {

	// ## constructor()
	// Creates the transformation matrix.
	constructor() {
		super([
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1,
		]);
	}

	// ## vector(a, b, c)
	// Helper function for returning a vector with the given components.
	vector(a, b = a+4, c=b+4) {
		return [this[a], this[b], this[c]];
	}

	get position() { return this.vector(3); }
	set position([x, y, z]) { this[3] = x; this[7] = y; this[11] = z; }

	// Getters and setters for the basis vectors now.
	get ex() { return this.vector(0); }
	set ex(v) { [this[0], this[4], this[8]] = v; }
	// set ex(v) { [this[0], this[1], this[2]] = v; }

	get ey() { return this.vector(1); }
	set ey(v) { [this[1], this[5], this[9]] = v; }
	// set ey(v) { [this[4], this[5], this[6]] = v; }

	get ez() { return this.vector(2); }
	set ez(v) { [this[2], this[6], this[10]] = v; }
	// set ez(v) { [this[8], this[9], this[10]] = v; }

	get basis() { return [this.ex, this.ey, this.ez]; }

	// ## parse(rs)
	// Parse the transformation matrix from a readable stream. We just read in 
	// all 16 float values.
	parse(rs) {
		for (let i = 0; i < this.length; i++) {
			this[i] = rs.float();
		}
		return this;
	}

	// ## write(ws)
	write(ws) {
		for (let i = 0; i < this.length; i++) {
			ws.float(this[i]);
		}
		return ws;
	}

}
