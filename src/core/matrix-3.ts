// # matrix-3.ts
import type Stream from './stream.js';
import type WriteBuffer from './write-buffer.js';

// # Matrix3
// Class for representing a 2D transformation matrix.
export default class Matrix3 extends Float32Array {
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
	parse(rs: Stream) {
		for (let i = 0; i < this.length; i++) {
			this[i] = rs.float();
		}
		return this;
	}

	// ## write(ws)
	write(ws: WriteBuffer) {
		for (let i = 0; i < this.length; i++) {
			ws.float(this[i]);
		}
		return ws;
	}

}
