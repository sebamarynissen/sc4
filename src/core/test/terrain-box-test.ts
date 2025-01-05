// # terrain-box-test.ts
import { expect } from 'chai';
import { resource } from '#test/files.js';
import Savegame from '../savegame.js';
import FileType from '../file-types.js';

describe('The terrain box', function() {

	it('parses a terrain with hills', function() {

		let dbpf = new Savegame(resource('City - Large developed.sc4'));
		let entry = dbpf.find({ type: FileType.TerrainBox })!;
		let box = entry.read();
		expect(box.xSize).to.equal(257);
		expect(box.zSize).to.equal(257);
		expect(box.minY).to.equal(230.10000610351562);
		expect(box.maxY).to.equal(847.2000122070312);

	});

	it('parses a flat terrain', function() {

		let dbpf = new Savegame(resource('City - Empty small tile.sc4'));
		let entry = dbpf.find({ type: FileType.TerrainBox })!;
		let box = entry.read();
		expect(box.xSize).to.equal(65);
		expect(box.zSize).to.equal(65);
		expect(box.minY).to.equal(270);
		expect(box.maxY).to.equal(270);

	});

});
