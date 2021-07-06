// # matrix-3.js
'use strict';

// # Matrix3
// Class for representing a 2D transformation matrix.
class Matrix3 extends Float32Array {
	constructor() {
		super([
			1, 0, 0,
			0, 1, 0,
			0, 0, 1,
		]);
	}

	// ## parse(rs)
	// Parses the transformation matrix from a readable stream. We just read 
	// in all 9 float values.
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
module.exports = Matrix3;
