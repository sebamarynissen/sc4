// # tract-info.ts
import type { tracts } from 'sc4/types';
import type Box3 from './box-3.js';
import type Stream from './stream.js';
import type WriteBuffer from './write-buffer.js';
import type { Vector3Like } from './vector-3.js';

// # TractInfo
// A class that contains some information about the tracts an object is part of. 
// Tracts are squares of 4x4 tiles that are used within the item index. 
type Vector2<T = tracts> = [x: T, z: T];
export default class TractInfo {

	// Tracts always start with an offset of 0x40 (64). Might be related to the 
	// fact that the item index is actually a quadtree where objects are only 
	// stored at the 4x4 level. Note sure if we'll abstract this away, we should 
	// probably remain as close as possible to the raw data structures.
	minX = 0x40;
	minZ = 0x40;
	maxX = 0x40;
	maxZ = 0x40;

	// Tracts are always 4x4 tiles, which means the *exponent* is given as 2
	// (2² = 4). This is likely constant in all game objects, but for some 
	// reason it is still stored in the savegame structures.
	xTractSize = 0x0002;
	zTractSize = 0x0002;

	// ## constructor(min, max)
	constructor(
		min: Vector2<tracts> = [0x40, 0x40],
		max: Vector2<tracts> = [0x40, 0x40],
	) {
		[this.minX, this.minZ] = min;
		[this.maxX, this.maxZ] = max;
	}

	// ## parse(rs)
	parse(rs: Stream) {
		this.minX = rs.byte();
		this.minZ = rs.byte();
		this.maxX = rs.byte();
		this.maxZ = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();
		return this;
	}

	// ## write(ws)
	write(ws: WriteBuffer) {
		ws.byte(this.minX);
		ws.byte(this.minZ);
		ws.byte(this.maxX);
		ws.byte(this.maxZ);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		return this;
	}

	// ## update()
	// Updates the tract info based on the given bbox, or in case an object has 
	// no bbox - such as flora - from a positional vector.
	update(record: { bbox: Box3 }): this;
	update(bbox: Box3): this;
	update(position: Vector3Like): this;
	update(from: { bbox: Box3 } | Box3 | Vector3Like): this {
		if ('bbox' in from) {
			return this.update(from.bbox);
		}
		const xSize = 16 * 2**this.xTractSize;
		const zSize = 16 * 2**this.zTractSize;
		if (isBbox(from)) {
			this.minX = 0x40 + Math.floor(from.minX / xSize);
			this.minZ = 0x40 + Math.floor(from.minZ / zSize);
			this.maxX = 0x40 + Math.floor(from.minX / xSize);
			this.maxZ = 0x40 + Math.floor(from.maxZ / zSize);
		} else {
			this.minX = this.maxX = 0x40 + Math.floor(from[0] / xSize);
			this.minZ = this.maxZ = 0x40 + Math.floor(from[2] / zSize);
		}
		return this;
	}

	// ## [Symbol.for('nodejs.util.inspect.custom')]
	[Symbol.for('nodejs.util.inspect.custom')]() {
		let { minX, minZ, maxX, maxZ } = this;
		return { minX, minZ, maxX, maxZ };
	}

}

function isBbox(object: any): object is Box3 {
	return Array.isArray(object[0]);
}
