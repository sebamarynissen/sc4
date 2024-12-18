// # vertex.ts
import Color from './color.js';
import type WriteBuffer from './write-buffer.js';
import type Stream from './stream.js';
import type { meters } from 'sc4/types';

type VertexOptions = {
	x?: number;
	y?: number;
	z?: number;
	u?: number;
	v?: number;
	color?: Color;
};

// # Vertex
// In quite a lot of subfiles often the sequence x, y, z, u, v, r, g, b, a 
// occurs. It looks like this is a vertex with [x, y, z] as coordinates,
// [u, v] as coordinates for u, v mapping and [r, g, b, a] as color value. In 
// order to make it easier to work with this, we've put them inside a separate 
// class.
export default class Vertex {
	x: meters = 0;
	y: meters = 0;
	z: meters = 0;
	u: number = 0;
	v: number = 0;
	color = new Color();

	// ## constructor(opts)
	constructor(opts?: VertexOptions) {
		if (opts) {
			Object.assign(this, opts);
		}
	}

	// ## parse(rs)
	parse(rs: Stream) {
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();
		this.u = rs.float();
		this.v = rs.float();
		this.color = rs.color();
	}

	// ## write(ws)
	write(ws: WriteBuffer) {
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		ws.float(this.u);
		ws.float(this.v);
		ws.color(this.color);
	}

}
