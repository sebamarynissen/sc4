// # pipe-manager.js
'use strict';
const Context = require('./city-context.js');
const Pipe = require('./pipe.js');
const Vertex = require('../lib/vertex.js');
const Color = require('../lib/color.js');
const Pointer = require('./pointer.js');

// Bit flags of what connections are enabled. Based on those sides we'll also 
// create a map of *lines* corresponding to those sides.
const WEST  = 0b0001;
const NORTH = 0b0010;
const EAST  = 0b0100;
const SOUTH = 0b1000;
const SIDE_MAP = new Map([
	[WEST, [0, 1, 0, 0]],
	[NORTH, [0, 0, 1, 0]],
	[EAST, [1, 0, 1, 1]],
	[SOUTH, [1, 1, 0, 1]],
]);

// # PipeManager
// The class we use for generating pipe layouts, more specifically generating 
// the *optimal* pipe layout for a city.
class PipeManager {

	// ## constructor(dbpf)
	constructor(dbpf, ctx = new Context(dbpf)) {
		this.dbpf = dbpf;
		this.ctx = ctx;
	}

	// Shortcuts.
	get sim() { return this.dbpf.plumbingSimulator; }
	get pipes() { return this.dbpf.pipes; }
	get terrain() { return this.dbpf.terrain; }
	get index() { return this.dbpf.itemIndex; }
	get serializer() { return this.dbpf.COMSerializerFile; }

	// ## applyOptimalLayout()
	// Applies the optimal pipe layout to the city.
	applyOptimalLayout() {

		// First of all clear the existing plumbing situation.
		const { sim, pipes } = this;
		sim.clear();
		pipes.length = 0;

		// Generate the ideal layout as a sparse array of one byte per tile 
		// and then actually create the tiles.
		let layout = this.generateOptimalLayout();

		// Next comes the hardest part. Before we can create the tiles, we 
		// need to create an *updated* terrain map where we egalize the tiles 
		// that require to be flat. note that for drawing roads, we should try 
		// to egalize the terrain for every drag operation, but for the pipes 
		// this isn't required and we can handle the layout at once.
		let flat = this.egalizeTerrain(this.terrain, layout);
		for (let [i, j, id] of layout) {
			let pipe = this.createTile(i, j, id, flat);
			pipes.push(pipe);
			sim.cells[j][i] = id;
			sim.pipes.push(new Pointer(pipe));
		}

		// Now rebuild the item index and update the com serializer and we're 
		// done!
		sim.revision++;
		this.index.rebuild(this.pipes);
		this.serializer.update(this.pipes);
		return this;

	}

	// ## generateOptimalLayout()
	// Generates the coordinates of all pipe tiles along with their connection 
	// identifier. Note that we return a sparse array, not a full map!
	generateOptimalLayout() {

		// 1. Determine the rows where we have to draw the pipes. If the last 
		// row is too far from the edge, we'll insert a new one manually where 
		// the intermediate distance will hence be less than optimal - but 
		// required anyway to cover the full city!
		const size = this.sim.xSize;
		const range = 6;
		let rows = [];
		let last;
		for (let j = range, dj = 2*range+1; j < size; j += dj) {
			rows.push(last = j);
		}
		if (size - last > range) rows.push(size-2);

		// 2. Insert the horizontal tiles. This has id 0x15, but we'll need to 
		// take into account the end pieces as well of course.
		const vertical = size/2-1;
		let out = [];
		for (let j of rows) {
			const a = Math.floor(range/2);
			const b = size-a-1;
			for (let i = a; i <= b; i++) {

				// Skip the crossing tiles for now, we'll handle those 
				// later on.
				if (i === vertical) continue;
				let id = i === a ? 0x14 : (i === b ? 0x11 : 0x15);
				out.push([i, j, id]);
			}
		}

		// 3. Draw the vertical lines, *including* the crossings.
		const [first] = rows;
		for (let j = first; j <= last; j++) {
			let id = 0b10000;
			if (j !== first) id ^= NORTH;
			if (j !== last) id ^= SOUTH;
			if (rows.includes(j)) {
				id ^= EAST;
				id ^= WEST;
			}
			out.push([vertical, j, id]);
		}

		// 4. We're done, return all the tiles.
		return out;

	}

	// ## egalizeTerrain(terrain, layout)
	// This returns a *cloned* of the terrain map where we egalized the parts 
	// that need it. For example, T and + pieces need to be completely flat, 
	// straight pieces need to be a tile.
	egalizeTerrain(terrain, layout) {

		// Filter out all pipe tiles that require a flat terrain tile and then 
		// egalize the terrain for that tile.
		let map = terrain.clone();
		let flats = new Set([
			0b1100,
			0b0110,
			0b0011,
			0b1001,
			0b1110,
			0b1101,
			0b1011,
			0b1110,
			0b1111,
		]);
		let straights = layout.filter(([i, j, id]) => {

			// We'll need the non-flat pieces later on as well so we'll filter 
			// them out in the same loop, hence return true early.
			if (!flats.has(id & 0b1111)) return true;

			// Cool, we now know that the tile has to be flattened, so we'll 
			// request the contours and set the *minimum* value as new value.
			map.flatten(i, j);
			return false;

		});

		// Flat tiles have been inserted. Now handle the straight tiles as 
		// well.
		for (let [i, j, id] of straights) {

			// Figure out the points that need to have the same height, which 
			// depends on the orientation obviously.
			let points;
			if (id & NORTH || id & SOUTH) {
				map.egalizeZ(i, j);
			} else {
				map.egalizeX(i, j);
			}

		}

		// We're done, return the egalized terrain map now.
		return map;

	}

	// ## createTile(i, j, id, map)
	// Actually creates a new pipe occupant tile and properly positions it.
	createTile(i, j, id, map) {

			// Calculate the metric x and z positions of the ne corner of the 
			// tile.
			const { terrain } = this;
			let x = 16*i;
			let z = 16*j;

			// Create the pipe tile and position it correctly first.
			let pipe = new Pipe({
				mem: this.ctx.mem(),
				x: x+8,
				z: z+8,
				xMin: x,
				xMax: x+16,
				zMin: z,
				zMax: z+16,
				xTile: i,
				zTile: j,
			});
			pipe.xMinTract = pipe.xMaxTract = 0x40 + Math.floor(i/4);
			pipe.zMinTract = pipe.zMaxTract = 0x40 + Math.floor(j/4);
			pipe.yModel = pipe.y = map.query(pipe.x, pipe.z)-1.4;

			// Set the heights at the corner of the terrain. Obviously we we 
			// need the actual *terrain* coordinates here, not the egalized 
			// underground terrain!
			let corners = [['NW', 'NE'], ['SW', 'SE']];
			let cornerValues = [];
			for (let j = 0; j < 2; j++) {
				for (let i = 0; i < 2; i++) {
					let xx = x+16*i;
					let zz = z+16*i;
					let h = pipe['y'+corners[j][i]] = terrain.query(xx, zz);
					cornerValues.push(h);
				}
			}
			pipe.yMax = Math.max(...cornerValues);
			pipe.yMin = Math.min(...map.contour(i, j));

			// Set the bottom vertices & bottom texture.
			for (let i = 0; i < 2; i++) {
				for (let j = 0; j < 2; j++) {
					let index = 2*i+j;
					let v = pipe.vertices[index];
					v.x = x+16*i;
					v.z = z+16*(i !== j);
					v.u = i;
					v.v = +(i !== j);
					v.y = map.query(v.x, v.z)-10.2;
				}
			}
			pipe.sideTextures.bottom = pipe.vertices.map(vertex => {
				let fresh = Object.assign(new Vertex(), vertex);
				fresh.color = new Color(0xff, 0xff, 0xff, 0x80);
				return fresh;
			});

			// Find out the connections for this tile based on the id that was 
			// specified.
			const west = !!(id & WEST);
			const north = !!(id & NORTH);
			const east = !!(id & EAST);
			const south = !!(id & SOUTH);

			// Find the sides where there are no connections and hence the 
			// lines that we need to draw.
			let lines = [];
			for (let [side, [di, dj, dii, djj]] of SIDE_MAP.entries()) {
				if (!(id & side)) {
					lines.push([
						[i+di, j+dj],
						[i+dii, j+djj],
					]);
				}
			}

			// Create the sides of the hole now based on the lines we've 
			// selected.
			for (let line of lines) {
				for (let i = 0; i < 2; i++) {
					for (let j = 0; j < 2; j++) {
						let vertex = new Vertex();
						let point = line[i];
						vertex.x = 16*point[0];
						vertex.z = 16*point[1];
						vertex.u = i;
						vertex.v = i !== j ? 0.6375007629394531 : 0;
						vertex.color = new Color(0xff, 0xff, 0xff, 0x80);
						let src = i !== j ? map : terrain;
						let h = src.query(vertex.x, vertex.z);
						vertex.y = h - (i !== j)*10.2;
						pipe.sideTextures[0].push(vertex);
					}
				}
				pipe.blocks++;
			}

			// Count how many connections we have now. This determines what 
			// model we have to insert as well as how to orient it.
			let sum = west + north + east + south;
			if (sum === 1) {
				pipe.textureId = 0x00000300;
				pipe.orientation = [south, west, north, east].indexOf(true);
			} else if (sum === 2) {
				pipe.textureId = 0x00004b00;
				pipe.orientation = west ? 1 : 0;
			} else if (sum === 3) {
				pipe.textureId = 0x00005700;
				pipe.orientation = [west, north, east, south].indexOf(false);
			} else if (sum === 4) {
				pipe.textureId = 0x00020700;
			}

			// Insert the prop model at the correct position and then rotate 
			// into place based on the orientation we've set on the tile.
			pipe.matrix.position = [pipe.x, pipe.y, pipe.z];
			if (pipe.orientation === 1) {
				pipe.matrix.ex = [0, 0, 1];
				pipe.matrix.ez = [-1, 0, 0];
			} else if (pipe.orientation === 2) {
				pipe.matrix.ex = [-1, 0, 0];
				pipe.matrix.ez = [0, 0, -1];
			} else if (pipe.orientation === 3) {
				pipe.matrix.ex = [0, 0, -1];
				pipe.matrix.ez = [1, 0, 0];
			}

			// Manually set our connection values as well.
			pipe.westConnection = west ? 0x02 : 0;
			pipe.northConnection = north ? 0x02 : 0;
			pipe.eastConnection = east ? 0x02 : 0;
			pipe.southConnection = south ? 0x02 : 0;
			return pipe;

		}

}
module.exports = PipeManager;
