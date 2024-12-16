// # vector-3.ts
import type Stream from './stream.js';
import type WriteBuffer from './write-buffer.js';
export type Vector3Like = [x: number, y: number, z: number] | Vector3;

// # Vector3
// Represents a three-dimensional vector. Note that we consider vectors to be 
// *value types*, so any operation on it returns a new vector. We don't modify 
// the vector by reference! Compare this how the new JavaScript temporal api is 
// designed.
export class Vector3 extends Array<number> {
	constructor(x: number = 0, y: number = 0, z: number = 0) {
		super(x, y, z);
	}

	get x() { return this[0]; }
	get y() { return this[1]; }
	get z() { return this[2]; }
	set x(value: number) { this[0] = value; }
	set y(value: number) { this[1] = value; }
	set z(value: number) { this[2] = value; }

	// ## add()
	add(dv: Vector3Like) {
		let [dx, dy, dz] = dv;
		return new Vector3(
			this.x + dx,
			this.y + dy,
			this.z + dz,
		);
	}

	// ## parse(rs)
	parse(rs: Stream) {
		this[0] = rs.float();
		this[1] = rs.float();
		this[2] = rs.float();
		return this;
	}

	// ## write(ws)
	write(ws: WriteBuffer) {
		ws.float(this[0]);
		ws.float(this[1]);
		ws.float(this[2]);
		return this;
	}

}
export default Vector3;
