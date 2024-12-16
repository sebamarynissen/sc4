// # box-3.ts
import type { meters } from 'sc4/types';
import type Stream from './stream.js';
import type WriteBuffer from './write-buffer.js';
import Vector3 from './vector-3.js';
import type { Vector3Like } from './vector-3.js';

// # Bbox
// A class for representing a bounding box of an occupant object. A lot of the 
// savegame data structures include minX, minY, minZ, maxX, maxY, maxZ, so it 
// makes sense to put it in a separate data structure, especially because it 
// makes parsing & serializing them easier to read.
export default class Box3 extends Array<Vector3> {
	
	// ## constructor(min, max)
	constructor(
		min: Vector3Like = [0, 0, 0],
		max: Vector3Like = [0, 0, 0],
	) {
		super(new Vector3(...min), new Vector3(...max));
	}

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

	// ## move()
	// Moves the bbox with the given vector.
	move(offset: Vector3): this;
	move(dx: meters, dy: meters, dz: meters): this;
	move(dx: Vector3 | meters = 0, dy: meters = 0, dz: meters = 0): this {
		if (Array.isArray(dx)) {
			[dx = 0, dy = 0, dz = 0] = dx;
		}
		this.minX += dx;
		this.maxX += dx;
		this.minY += dy;
		this.maxY += dy;
		this.minZ += dz;
		this.maxZ += dz;
		return this;
	}

	// ## parse(rs)
	parse(rs: Stream) {
		this[0] = rs.vector3();
		this[1] = rs.vector3();
		return this;
	}

	// ## write(ws)
	write(ws: WriteBuffer) {
		let [min, max] = this;
		ws.vector3(min);
		ws.vector3(max);
		return this;
	}

}
