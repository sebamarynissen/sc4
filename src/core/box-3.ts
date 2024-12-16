// # box-3.ts
import type { meters } from 'sc4/types';
import type Stream from './stream.js';
import type WriteBuffer from './write-buffer.js';
import Vector3 from './vector-3.js';
import type { Vector3Like } from './vector-3.js';

// A bbox can be parsed in two ways: [[minX, minY, minZ], [maxX, maxY, maxZ]] - 
// which happens with props & buildings etc. Other occupants like pipes and 
// networks use a different parsing format - great - being
// [[minX, maxX], [minY, maxY], [minZ, maxX]] - which we'll call "range mode".
export type ParseOptions = {
	range: boolean,
};

// # Bbox
// A class for representing a bounding box of an occupant object. A lot of the 
// savegame data structures include minX, minY, minZ, maxX, maxY, maxZ, so it 
// makes sense to put it in a separate data structure, especially because it 
// makes parsing & serializing them easier to read.
export class Box3 extends Array<Vector3> {
	
	// ## constructor(min, max)
	constructor(
		min: Vector3Like = [0, 0, 0],
		max: Vector3Like = [0, 0, 0],
	) {
		super(new Vector3(...min), new Vector3(...max));
	}

	get min(): Vector3 { return this[0]; }
	get max(): Vector3 { return this[1]; }
	get minX(): meters { return this[0][0]; }
	get minY(): meters { return this[0][1]; }
	get minZ(): meters { return this[0][2]; }
	get maxX(): meters { return this[1][0]; }
	get maxY(): meters { return this[1][1]; }
	get maxZ(): meters { return this[1][2]; }

	set minX(value: meters) { this[0][0] = value; }
	set minY(value: meters) { this[0][1] = value; }
	set minZ(value: meters) { this[0][2] = value; }
	set maxX(value: meters) { this[1][0] = value; }
	set maxY(value: meters) { this[1][1] = value; }
	set maxZ(value: meters) { this[1][2] = value; }

	// ## translate(offset)
	// Translates the box with the given vector, and returns a *new* box.
	translate(offset: Vector3Like) {
		return new Box3(
			this.min.add(offset),
			this.max.add(offset),
		);
	}

	// ## parse(rs)
	parse(rs: Stream, opts: ParseOptions = { range: false }) {
		if (opts.range) {
			let minX = rs.float();
			let maxX = rs.float();
			let minY = rs.float();
			let maxY = rs.float();
			let minZ = rs.float();
			let maxZ = rs.float();
			this[0] = new Vector3(minX, minY, minZ);
			this[1] = new Vector3(maxX, maxY, maxZ);
		} else {
			this[0] = rs.vector3();
			this[1] = rs.vector3();
		}
		return this;
	}

	// ## write(ws)
	write(ws: WriteBuffer, opts: ParseOptions = { range: false }) {
		let [min, max] = this;
		if (opts.range) {
			ws.float(min.x);
			ws.float(max.x);
			ws.float(min.y);
			ws.float(max.y);
			ws.float(min.z);
			ws.float(max.z);
		} else {
			ws.vector3(min);
			ws.vector3(max);
		}
		return this;
	}

}
export default Box3;
