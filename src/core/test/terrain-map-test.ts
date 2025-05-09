// # terrain-map-test.ts
import { expect } from 'chai';
import { SmartBuffer } from 'smart-arraybuffer';
import { compareUint8Arrays } from 'uint8array-extras';
import fs from '#test/fs.js';
import { DBPF, TerrainMap, FileType } from 'sc4/core';
import { resource } from '#test/files.js';

describe('The terrain map', function() {

	it('is be parsed & serialized correctly', function() {

		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);
		let entry = dbpf.find({
			type: FileType.TerrainMap,
			instance: 0x00000001,
		})!;
		let terrain = entry.read();
		expect(terrain.xSize).to.equal(257);
		expect(terrain.zSize).to.equal(257);
		expect(terrain).to.have.length(terrain.xSize);

		let source = entry.decompress();
		let check = terrain.toBuffer();
		expect(compareUint8Arrays(source, check)).to.equal(0);

	});

	it('accepts a size in tile', function() {

		let terrain = new TerrainMap(4);
		expect(terrain).to.have.length(5);
		terrain.forEach(row => expect(row).to.have.length(5));

	});

	it('serializes row-first', function() {

		let buff = new ArrayBuffer(2+ 4*5**2);
		new DataView(buff).setUint16(0, 2, true);
		let terrain = new TerrainMap();
		terrain.parse(new Uint8Array(buff));
		terrain[0][1] = 10;

		let out = SmartBuffer.fromBuffer(terrain.toBuffer());
		expect(out.readFloatLE(6)).to.equal(10);

	});

	it('performs a terrain query', function() {

		let map = new TerrainMap(2);
		map[0][1] = 5;

		// Tile [0, 0]
		expect(map.query(2, 3)).to.equal(0);
		expect(map.query(8, 8)).to.equal(0);
		expect(map.query(16, 8)).to.equal(2.5);
		expect(map.query(16, 0)).to.equal(5);
		expect(map.query(16, 16)).to.equal(0);

		// Tile [1, 0]
		expect(map.query(16+8, 8)).to.equal(2.5);
		expect(map.query(16+16, 8)).to.equal(0);
		expect(map.query(16+8, 16)).to.equal(0);
		expect(map.query(16+16, 16)).to.equal(0);

	});

	it('performs a terrain query on the edges', function() {
		let map = new TerrainMap(1);
		map.raw.set([0, 1, 3, 2]);
		expect(map.query(0, 0)).to.equal(0);
		expect(map.query(8, 0)).to.equal(0.5);
		expect(map.query(16, 0)).to.equal(1);
		expect(map.query(16, 8)).to.equal(1.5);
		expect(map.query(16, 16)).to.equal(2);
		expect(map.query(8, 16)).to.equal(2.5);
		expect(map.query(0, 16)).to.equal(3);
		expect(map.query(0, 8)).to.equal(1.5);
	});

	it('performs a terrain query on cliffs', function() {

		let map = new TerrainMap(2);
		map[1][1] = 20;

		expect(map.query(0, 0)).to.equal(0);
		expect(map.query(8, 8)).to.equal(0);
		expect(map.query(16, 16)).to.equal(20);
		expect(map.query(24, 8)).to.equal(0);
		expect(map.query(16, 32)).to.equal(0);
		expect(map.query(24, 24)).to.equal(0);
		expect(map.query(24, 8)).to.equal(0);

	});

	it('clones a terrain map', function() {

		let map = new TerrainMap(1);
		map[0][0] = 0.5;
		let clone = map.clone();
		expect(clone[0][0]).to.equal(0.5);
		clone[0][0] = Math.E;
		expect(map[0][0]).to.equal(0.5);

	});

});
