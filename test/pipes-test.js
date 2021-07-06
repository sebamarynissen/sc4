// # pipes-test.js
'use strict';
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { Savegame, DBPF } = require('sc4');
const FileType = require('../lib/file-types.js');
const Pipe = require('../lib/pipe.js');
const Pointer = require('../lib/pointer.js');
const { chunk, getCityPath, getTestFile } = require('../lib/util.js');

describe('The pipes subfile', function() {

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

	const keys = ['xMin', 'westConnection', 'northConnection', 'eastConnection', 'southConnection', 'orientation'];

	it.only('a pipe map', async function() {

		// Read in a target city and clear the pipes and pipe simulator.
		let file = getTestFile('City - Single Pipe.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { pipes, plumbingSimulator } = dbpf;
		pipes.length = 0;
		plumbingSimulator.clear();

		function dump(map) {
			console.log(map.map(x => x.join('')).join('\n'));
		}

		// Helper function for creating the data for the bottom texture.
		const depth = 10.2;
		function bottom([A, B, C, D], h) {
			let rgb = { r: 0xff, g: 0xff, b: 0xff, a: 0x80 };
			let y = h-depth;
			return [
				{ x: A[0], y, z: A[1], u: 0, v: 0, ...rgb },
				{ x: D[0], y, z: D[1], u: 1, v: 0, ...rgb },
				{ x: C[0], y, z: C[1], u: 1, v: 1, ...rgb },
				{ x: B[0], y, z: B[1], u: 0, v: 1, ...rgb },
			];
		}

		// Helper function for creating the data for the side texture.
		function side([P, Q], h) {
			let rgb = { r: 0xff, g: 0xff, b: 0xff, a: 0x80 };
			let g = h-depth;
			let w = 0.6375007629394531;
			return [
				{ x: P[0], y: h, z: P[1], u: 0, v: 0, ...rgb },
				{ x: P[0], y: g, z: P[1], u: 0, v: w, ...rgb },
				{ x: Q[0], y: g, z: Q[1], u: 1, v: w, ...rgb },
				{ x: Q[0], y: h, z: Q[1], u: 1, v: 0, ...rgb },
			];
		}

		let map = Array(64).fill().map(() => Array(64).fill('.'));
		map[0][0] = '<';
		map[0][1] = '>';
		// map[2][1] = '<';
		// map[2][2] = '-';
		// map[2][3] = '+';
		// map[2][4] = '-';
		// map[2][5] = '>';
		// map[0][3] = '^';
		// map[1][3] = '|';
		// map[3][3] = '|';
		// map[4][3] = 'v';
		// dump(map);

		// Cool, now generate all tiles from it.
		let mem = 10;
		function add(symbol, i, j) {

			// Ignore empty tiles.
			if (symbol === '.' || symbol === ' ') return;

			// Generate the coordinates of the square this tile occupies.
			let x = 16*i;
			let z = 16*j;
			let h = 270;
			let square = [[x, z], [x+16, z], [x+16, z+16], [x, z+16]];
			let [A, B, C, D] = square;

			// Create the tile and immediately position it.
			let tile = new Pipe({ mem: mem++ });
			tile.xMinTract = tile.xMaxTract = 0x40 + Math.floor(i / 4);
			tile.zMinTract = tile.zMaxTract = 0x40 + Math.floor(j / 4);
			tile.xMin = x;
			tile.xMax = x+8;
			tile.zMin = z;
			tile.zMax = z+8;
			tile.yMin = h-depth;
			tile.yMax = h-depth+8.8;
			tile.x = x;
			tile.y = h-depth;
			tile.z = z+16;
			tile.x2 = x+16;
			tile.y2 = h-depth;
			tile.z2 = z+16;
			tile.x3 = x+16;
			tile.y3 = h-depth;
			tile.z3 = z;
			tile.xMin2 = x;
			tile.xMax2 = x+16;
			tile.yMin2 = h-depth;
			tile.yMax2 = h;
			tile.zMin2 = z;
			tile.zMax2 = z+16;

			// Choose the correct prop model.
			if ('<>^v'.includes(symbol)) {
				tile.textureId = 0x00000300;
			} else if ('|-'.includes(symbol)) {
				tile.textureId = 0x00004b00;
			} else if (symbol === '+') {
				tile.textureId = 0x00020700;
			}

			// Correctly set the tile's orientation.
			if ('<'.includes(symbol)) {
				tile.orientation = 3;
			} else if ('->'.includes(symbol)) {
				tile.orientation = 1;
			}

			// Now position the prop model.
			tile.matrix.position = [x+8, h-1.4, z+8];

			// Store what sides have a connection based on the symbol. We'll 
			// store this as an array as well so that we can programmatically 
			// process it later on.
			let connections = [
				'>-+'.includes(symbol),
				'v|+'.includes(symbol),
				'<-+'.includes(symbol),
				'^|+'.includes(symbol),
			];
			tile.westConnection = 2*connections[0];
			tile.northConnection = 2*connections[1];
			tile.eastConnection = 2*connections[2];
			tile.southConnection = 2*connections[3];

			// Create the side textures based on our connections.
			let sidemap = [0, 1, 3, 2];
			connections.forEach((yes, i) => {
				if (yes) return;
				tile.blocks++;
				let P = square[(i+3)%4];
				let Q = square[i];
				tile.sideTextures[sidemap[i]] = side([P, Q], h);
			});

			// Always add a bottom texture.
			tile.sideTextures[4] = bottom(square, h);

			// At last push in the tile.
			pipes.push(tile);

		}
		map.forEach((row, z) => row.forEach((tile, x) => add(tile, x, z)));

		console.table(pipes, keys);
		console.table(pipes[0].sideTextures.map(x => x.map(_ => [_.x, _.z])));

		// Rebuild the item index so everything gets properly drawn and update 
		// the com serializer.
		dbpf.itemIndex.rebuild(pipes);
		dbpf.COMSerializerFile.set(FileType.PipeFile, pipes.length);
		await dbpf.save(getCityPath('Pipes'));

	});

	it.only('generates a pipe network', async function() {

		// let file = path.resolve(__dirname, 'files/City - Single Pipe.sc4');
		// let file = path.resolve(__dirname, 'files/City - Pipes.sc4');
		let file = getCityPath('Piped');
		// let file = getCityPath('Strateigia', 'New Delphina');
		// let file = getCityPath('New Delphina', 'New Delphina');
		// let file = getCityPath('New Sebastia', 'New Delphina');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { pipes, itemIndex } = dbpf;

		pipes.sort((a, b) => a.xMin - b.xMin);
		console.table(pipes, keys)

		// Clear the plumbing simulator.
		let sim = dbpf.plumbingSimulator;
		// console.log(sim.cells.slice(0, 3).map(x => x.slice(0, 10).map(nr => nr.toString(2).padStart(5, '0')).join(' ')));
		// return;
		sim.clear();

		// Clear all pipe occupants.
		let [original] = pipes;
		console.table(pipes[0].sideTextures.map(x => x.map(_ => [_.x, _.z])));
		return;

		pipes.length = 0;

		let grid = dbpf.getSimGrid(FileType.SimGridUint8, 0x49d5bb8c);

		// Clear all pipes so we can generate new ones.
		// pipes.length = 0;
		const straight = 0b10000;
		const east = 0b0100;
		const west = 0b0001;
		const north = 0b0010;
		const south = 0b1000;
		let max = 64-3;
		let mem = 0;
		for (let j = 6; j < 64; j += 7) {
			let z = j*16;
			for (let i = 3; i < max; i++) {
				let x = i*16;
				let tile = new Pipe({
					mem: 10+(mem++),
					xMinTract: 0x40 + Math.floor(x / 64),
					xMaxTract: 0x40 + Math.floor(x / 64),
					zMinTract: 0x40 + Math.floor(z / 64),
					zMaxTract: 0x40 + Math.floor(z / 64),
					xMin: x,
					xMax: x+8,
					zMin: z,
					zMax: z+8,
					yMin: float(270-10.2),
					yMax: float(270-10.2+8.8),
					// textureId: 0x100,
					textureId: (i === 3 || i+1 === max) ? 0x00000300 : 0x00004b00,
					x: x,
					y: float(270-10.2),
					z: z+16,
					x2: x+16,
					y2: float(270-10.2),
					z2: z+16,
					x3: x+16,
					y3: float(270-10.2),
					z3: z,
					orientation: 1,
					westConnection: 0,
					eastConnection: 0,
					xMin2: x,
					xMax2: x+16,
					yMin2: float(270-10.2),
					yMax2: 270,
					zMin2: z,
					zMax2: z+16,
					blocks: 0,
					y4: 270,
					y5: 270,
					y6: 270,
					y7: 270,
				});
				tile.matrix.position = [x+8, 270-1.4, z+8];
				if (i === 0) {
					tile.matrix.ex = [0, 0, -1];
					tile.matrix.ey = [0, 1, 0];
					tile.matrix.ez = [1, 0, 0];
				} else {
					tile.matrix.ex = [0, 0, 1];
					tile.matrix.ey = [0, 1, 0];
					tile.matrix.ez = [-1, 0, 0];
				}
				let rgb = { r: 0xff, g: 0xff, b: 0xff, b: 0x80 };
				tile.sideTextures[4] = [
					{ x: x, y: 270-10.2, z: z, u: 0, v: 0, ...rgb },
					{ x: x, y: 270-10.2, z: z+16, u: 1, v: 0, ...rgb },
					{ x: x+16, y: 270-10.2, z: z+16, u: 1, v: 1, ...rgb },
					{ x: x+16, y: 270-10.2, z: z, u: 0, v: 1, ...rgb },
				];
				pipes.push(tile);

				// Include in the plumbing simulator.
				sim.cells[j][i] = straight ^ (i+1 !== max ? east : 0) ^ (i !== 3 ? west : 0);
				sim.pipes.push(new Pointer(tile));

			}

		}

		// console.table([original, tile], Object.keys(tile).filter(key => key !== 'sideTextures' && key !== 'matrix'));
		// console.table([original.matrix, tile.matrix]);
		// console.table([original.unknown, tile.unknown]);

		console.log(sim);

		// Rebuild the item index with our pipes network that we've created.
		itemIndex.rebuild(pipes);

		// At last update the com serializer.
		let com = dbpf.COMSerializerFile;
		com.set(FileType.PipeFile, pipes.length);

		await dbpf.save(getCityPath('Pipes', 'Experiments'));

	});

});
