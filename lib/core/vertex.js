// # vertex.js
import Color from './color.js';

// # Vertex
// In quite a lot of subfiles often the sequence x, y, z, u, v, r, g, b, a 
// occurs. It looks like this is a vertex with [x, y, z] as coordinates,
// [u, v] as coordinates for u, v mapping and [r, g, b, a] as color value. In 
// order to make it easier to work with this, we've put them inside a separate 
// class.
export default class Vertex {

	// ## constructor()
	constructor() {
		this.x = 0;
		this.y = 0;
		this.z = 0;
		this.u = 0;
		this.v = 0;
		this.color = new Color();
	}

	// ## parse(rs)
	parse(rs) {
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();
		this.u = rs.float();
		this.v = rs.float();
		this.color = rs.color();
	}

	// ## write(ws)
	write(ws) {
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		ws.float(this.u);
		ws.float(this.v);
		ws.color(this.color);
	}

}
