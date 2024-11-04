// # network-dev.js
const fs = require('fs');
const { expect } = require('chai');
const Network = require('../lib/network.js');
const { getCityPath, getTestFile } = require('../lib/util.js');
const Savegame = require('../lib/savegame.js');
const Color = require('../lib/color.js');
const Pointer = require('../lib/pointer.js');

describe('A network tile', function() {

	it('is parsed and serialized correctly', function() {

		let file = getTestFile('City - Large Developed.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { network } = dbpf;
		let raw = dbpf.find(network.type).decompress();
		let out = network.toBuffer();
		expect(Buffer.compare(raw, out)).to.equal(0);

	});

	it.skip('plays with values', async function() {

		let file = getCityPath('Network');
		// let file = getCityPath('Wayside', 'New Delphina');
		// let file = getCityPath('New Delphina', 'New Delphina');
		// let file = getCityPath('New Sebastia', 'New Delphina');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);

		let map = global.map = new Map();
		for (let tile of dbpf.network) {
			map.set(tile.mem, tile);
		}
		for (let tile of dbpf.prebuiltNetwork) {
			map.set(tile.mem, tile);
		}

		let tiles = dbpf.networkIndex.tiles;
		tiles = tiles.filter(x => map.get(+x.pointer));
		tiles.sort((a, b) => {
			let at = map.get(+a.pointer);
			let bt = map.get(+b.pointer);
			return at.x - bt.x || at.z - bt.z;
		});
		for (let block of tiles) {
			let tile = map.get(+block.pointer);
			let x = tile.x/16-0.5;
			let z = tile.z/16-0.5;
			console.log(x, z, block.reps);
		}

	});

	it('reads the model network', async function() {

		let file = getCityPath('Network');
		// let file = getCityPath('New Delphina', 'New Delphina');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { network } = dbpf;
		network.sort((a, b) => a.z - b.z);
		console.table(network);
		console.table(network[2].vertices);

	});

	it('checks the network index', function() {

		let source = getCityPath('Road Construction');
		let dbpf = new Savegame(source);
		console.log(dbpf.networkIndex);

	});

	it.skip('draws roads', async function() {

		let source = getTestFile('City - Road Construction.sc4');
		let out = getCityPath('Road Construction');
		let buffer = fs.readFileSync(source);
		let dbpf = new Savegame(buffer);

		// Properly clear the network and the network index.
		let { network, networkIndex, regionView: info } = dbpf;
		network.length = 0;
		networkIndex.tiles = [];

		const textures = createTable([
			[0x00000100, 0b0000],
			[0x00000300, 0b1000, 0b0100, 0b0010, 0b0001],
			[0x00004b00, 0b1010, 0b0101],
			[0x00000f00, 0b1100, 0b0110, 0b0011, 0b1001],
			[0x00020700, 0b1111],
			[0x00005700, 0b1110, 0b1101, 0b1011, 0b0111],
		]);
		const orientations = createTable([
			[0, 0b0101, 0b0001, 0b0011, 0b0111, 0b0000, 0b1111],
			[1, 0b1000, 0b1001, 0b1011],
			[2, 0b0100, 0b1100, 0b1101],
			[3, 0b1010, 0b0010, 0b0110, 0b1110],
		]);

		// Helper function for creating a table that maps identifiers to other 
		// stuff (like textures or orientations).
		function createTable(arr) {
			return arr.reduce((map, [value, ...ids]) => {
				ids.forEach(id => map[id] = value);
				return map;
			}, Array(0b10000));
		}

		// The function that will create a road tile based on the id that 
		// indicates what connections need to be allowed. Note that this 
		// obviously doesn't support diagonals and FAR. That's definitely ok 
		// for now.
		let mem = 10;
		function createTile(i, j, id = 0b0000) {

			let x = 16*i;
			let z = 16*j;
			let y = 270;
			let tile = new Network({
				mem: mem++,
				x: x+8,
				y,
				z: z+8,
				xMin: x,
				xMax: x+16,
				yMin: y,
				yMax: y,
				zMin: z,
				zMax: z+16,
			});

			// Properly derive the tracts.
			tile.xMinTract = tile.xMaxTract = 0x40 + Math.floor(tile.x/64);
			tile.zMinTract = tile.zMaxTract = 0x40 + Math.floor(tile.z/64);

			// Set the texture itself and its orientation.
			tile.textureId = textures[id];
			tile.orientation = orientations[id] || 0;

			// Ensure the connections are correctly set.
			tile.westConnection = (id & 0b1000) ? 0x02 : 0x00;
			tile.northConnection = (id & 0b0100) ? 0x02 : 0x00;
			tile.eastConnection = (id & 0b0010) ? 0x02 : 0x00;
			tile.southConnection = (id & 0b0001) ? 0x02 : 0x00;

			// Set the texture vertices. The uv coordinates here depend on the 
			// orientation.
			let color = new Color(0xde, 0xdb, 0xdd, 0xff);
			let uv = [
				[[0, 0], [0, 1], [1, 1], [1, 0]],
				[[0, 1], [1, 1], [1, 0], [0, 0]],
				[[1, 1], [1, 0], [0, 0], [0, 1]],
				[[1, 0], [0, 0], [0, 1], [1, 1]],
			][tile.orientation].map(([u, v]) => ({ u, v, color }));
			Object.assign(tile.vertices[0], { x, y, z, ...uv[0] });
			Object.assign(tile.vertices[1], { x, y, z: z+16, ...uv[1] });
			Object.assign(tile.vertices[2], { x: x+16, y, z: z+16, ...uv[2] });
			Object.assign(tile.vertices[3], { x: x+16, y, z, ...uv[3] });

			// Create a network index tile for it.
			let indexTile = networkIndex.tile();
			indexTile.nr = 64*info.xSize*j + i;
			indexTile.pointer = new Pointer(tile);
			networkIndex.tiles.push(indexTile);

			// Insert the tile in the network subfile and network index.
			network.push(tile);

		}

		// The function responsible for actually drawing the street map.
		function draw(map) {
			for (let i = 0; i < map.length; i++) {
				let col = map[i];
				for (let j = 0; j < col.length; j++) {
					let id = col[j];
					if (id) {
						createTile(i, j, id);
					}
				}
			}
		}

		// Construct the streetmap.
		let streetmap = Array(64).fill().map(() => new Uint8Array(64).fill(0));
		for (let i = 2; i <= 8; i++) {
			if (i > 2) streetmap[i][5] ^= 0b1000;
			if (i < 8) streetmap[i][5] ^= 0b0010;
		}
		for (let i = 2; i <= 8; i++) {
			if (i > 2) streetmap[5][i] ^= 0b0100;
			if (i < 8) streetmap[5][i] ^= 0b0001;
		}

		// And draw it.
		draw(streetmap);

		// Sort the networkIndex.
		networkIndex.tiles.sort((a, b) => a.nr - b.nr);
		dbpf.itemIndex.rebuild(network);
		dbpf.COMSerializerFile.update(network);

		// Save at last.
		await dbpf.save(out);

	});

});
