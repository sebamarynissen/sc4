// # network-test.js
'use strict';
const fs = require('fs');
const { expect } = require('chai');
const Network = require('../lib/network.js');
const { getCityPath, getTestFile } = require('../lib/util.js');
const Savegame = require('../lib/savegame.js');

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
