// # pipes-test.js
'use strict';
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { Savegame, DBPF } = require('sc4');
const FileType = require('../lib/file-types.js');
const Pipe = require('../lib/pipe.js');
const Pointer = require('../lib/pointer.js');
const Vertex = require('../lib/vertex.js');
const Color = require('../lib/color.js');
const { chunk, getCityPath, getTestFile } = require('../lib/util.js');

describe('The pipes subfile', function() {

	before(function() {
		this.open = function(file) {
			let buffer = fs.readFileSync(file);
			return new Savegame(buffer);
		};
	});

	function getKeys(pipes) {
		return Object.keys(pipes[0]).filter(x => {
			return !'crc mem major minor xMinTract zMinTract xMaxTact zMaxTract GID TID IID matrix3 xTractSize zTractSize'.split(' ').includes(x);
			// return x.startsWith('x') || x.startsWith('z');
		});
	}

	it('is parsed correctly & serialized correctly', function() {

		let file = path.resolve(__dirname, 'files/City - Pipes.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new DBPF(buffer);

		let entry = dbpf.find(0x49c05b9f);
		let raw = entry.decompress();
		let pipes = entry.read();
		let out = pipes.toBuffer();
		expect(Buffer.compare(out, raw)).to.equal(0);

	});

	it.only('generates a straight section of pipes', async function() {
		
		// Open the city and then clear the current pipes.
		// const out = getCityPath('Pipes');
		const out = getCityPath('Hilly Skyline');
		// let dbpf = this.open(getTestFile('City - Single Pipe.sc4'));
		let dbpf = this.open(getTestFile('City - Hilly skyline.sc4'));
		let { pipes, plumbingSimulator: sim, terrain } = dbpf;
		pipes.length = 0;
		sim.clear();

		// Bit flags of what connections are enabled. Based on those sides 
		// we'll also create a map of *lines* corresponding to those sides.
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

		// The function that generates the coordinates of all tiles and 
		// connection identifier on that tile. Note that we return a sparse 
		// array, not a full map. That's for later on!
		function generateLayout(size) {
			
			// 1. Determine the rows where we have to draw the pipes. If the 
			// last row is too far from the edge, we'll insert a new one 
			// manually where the intermediate distance will hence be less 
			// than optimal - but required anyway to cover the full city!
			const range = 6;
			let rows = [];
			let last;
			for (let j = range, dj = 2*range+1; j < size; j += dj) {
				rows.push(last = j);
			}
			if (size - last > range) rows.push(size-2);

			// 2. Insert the horizontal tiles. This has id 0x15, but we'll 
			// need to take into account the end pieces as well of course.
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

			// x. We're done, return all the tiles.
			return out;

		}

		// The function we use for creating a pipe on tile (i, j) with the 
		// connections given as the byte as it appears in the plumbing 
		// simulator. Note that this is not sufficient for diagonal tiles, but 
		// we don't use them anyway, so all is good on that front.
		const h = 270;
		let mem = 10;
		function createTile(i, j, id = 0) {

			// Calculate the metric x and z positions of the ne corner of the 
			// tile.
			let x = 16*i;
			let z = 16*j;

			// Create the pipe tile and position it correctly first.
			let pipe = new Pipe({
				mem: mem++,
				x: x+8,
				z: z+8,
				xMin: x,
				xMax: x+16,
				yMin: h-10.2,
				yMax: h,
				zMin: z,
				zMax: z+16,
				xTile: i,
				zTile: j,
			});
			pipe.xMinTract = pipe.xMaxTract = 0x40 + Math.floor(i/4);
			pipe.zMinTract = pipe.zMaxTract = 0x40 + Math.floor(j/4);
			pipe.yModel = pipe.y = terrain.query(pipe.x, pipe.z)-1.4;

			// Set the heights at the corner of the terrain.
			let corners = [['NW', 'NE'], ['SW', 'SE']];
			for (let j = 0; j < 2; j++) {
				for (let i = 0; i < 2; i++) {
					let xx = x+16*i;
					let zz = z+16*i;
					pipe['y'+corners[j][i]] = terrain.query(xx, zz);
				}
			}

			// Set the bottom vertices & bottom texture.
			for (let i = 0; i < 2; i++) {
				for (let j = 0; j < 2; j++) {
					let index = 2*i+j;
					let v = pipe.vertices[index];
					v.x = x+16*i;
					// v.y = h-10.2;
					v.z = z+16*(i !== j);
					v.u = i;
					v.v = +(i !== j);
					v.y = terrain.query(v.x, v.z)-10.2;
				}
			}
			pipe.sideTextures.bottom = pipe.vertices.map(vertex => {
				let fresh = Object.assign(new Vertex(), vertex);
				fresh.color = new Color(0xff, 0xff, 0xff, 0x80);
				fresh.y = terrain.query(fresh.x, fresh.z)-10.2;
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
						let h = terrain.query(vertex.x, vertex.z);
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

		// First generate the ideal layout, which returns a sparse array of 
		// all cells. Then well loop every cell, insert it into the plumbing 
		// simulator and create a pipe tile for it as well.
		let layout = generateLayout(sim.xSize);
		for (let [i, j, id] of layout) {
			sim.cells[j][i] = id;
			let pipe = createTile(i, j, id);
			pipes.push(pipe);
			sim.pipes.push(new Pointer(pipe));
		}

		// Now rebuild the item index and store in the com serializer.
		// console.table(pipes, getKeys(pipes));
		// console.table(pipes[0].vertices);
		// console.table(pipes[0].sideTextures[4]);
		sim.revision++;
		dbpf.itemIndex.rebuild(pipes);
		dbpf.COMSerializerFile.set(FileType.PipeFile, pipes.length);
		await dbpf.save(out);

	});

	it.skip('plays with some values', async function() {

		// let dbpf = this.open(getTestFile('City - Single Pipe.sc4'));
		let dbpf = this.open(getCityPath('Piped'));
		// let dbpf = this.open(getCityPath('New Sebastia', 'New Delphina'));
		let { pipes } = dbpf;
		let pipe = pipes.find(pipe => pipe.xTile === 8);
		console.table([pipe], Object.keys(pipe).filter(key => key.startsWith('y')));
		console.table(pipe.vertices);
		console.log(pipe.matrix3);
		console.log(pipe.matrix);
		console.table(pipe.sideTextures.bottom);
		// console.table(pipes[0].sideTextures[1]);
		// console.log(dbpf.plumbingSimulator.cells);
		// console.table(pipes, getKeys(dbpf.pipes));
		// console.table(pipes[0].vertices);
		// console.table(pipes[0].sideTextures[4]);

		// await dbpf.save(getCityPath('Pipes'));

	});

});
