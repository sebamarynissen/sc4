// # network-test.js
'use strict';
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

	it.skip('reads the model network', async function() {

		// let file = getCityPath('Network');
		let file = getCityPath('New Delphina', 'New Delphina');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { network } = dbpf;
		network.sort((a, b) => a.z - b.z);
		console.log(network[0].vertices);
		console.table(network);
		console.log(dbpf.networkIndex);

	});

	it.only('draws a road', async function() {

		let source = getTestFile('City - Road Construction.sc4');
		let out = getCityPath('Road Construction');
		let buffer = fs.readFileSync(source);
		let dbpf = new Savegame(buffer);

		let { network, networkIndex, itemIndex } = dbpf;
		let i = 10;
		let j = 5;
		let x = 16*i;
		let z = 16*j;
		let tile = new Network();
		tile.mem = 0x12345678;
		tile.xMinTract = tile.xMaxTract = 0x40 + Math.floor(x/64);
		tile.zMinTract = tile.zMaxTract = 0x40 + Math.floor(z/64);
		tile.x = x+8;
		tile.y = 270;
		tile.z = z+8;
		let color = new Color(0xde, 0xdb, 0xdd, 0xff);
		Object.assign(tile.vertices[0], { x: x, y: 270, z: z, u: 0, v: 0, color });
		Object.assign(tile.vertices[1], { x: x, y: 270, z: z+16, u: 0, v: 1, color });
		Object.assign(tile.vertices[2], { x: x+16, y: 270, z: z+16, u: 1, v: 1, color });
		Object.assign(tile.vertices[3], { x: x+16, y: 270, z: z, u: 1, v: 0, color });
		tile.textureId = 0x00000100;
		tile.xMin = x;
		tile.xMax = x+16;
		tile.yMin = tile.yMax = 270;
		tile.zMin = z;
		tile.zMax = z+16;
		tile.unknown[6][1] = 0x80;
		network.push(tile);

		let indexTile = networkIndex.tile();
		indexTile.nr = 64*(tile.z/16-0.5) + tile.x/16 -0.5;
		indexTile.pointer = new Pointer(network[0]);

		console.log(networkIndex.tiles);
		networkIndex.tiles = [];
		networkIndex.tiles.push(indexTile);

		console.log(networkIndex.tiles);

		// Rebuild the item index from it and update the com seralizer.
		itemIndex.rebuild(network);
		dbpf.COMSerializerFile.update(network);

		await dbpf.save(out);

	});

});

describe('The network index', function() {

	it('is parsed and serialized correctly', function() {

		let file = getTestFile('City - Large Developed.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { networkIndex } = dbpf;
		let raw = dbpf.find(networkIndex.type).decompress();
		let out = networkIndex.toBuffer();
		expect(Buffer.compare(out, raw)).to.equal(0);

	});

});
