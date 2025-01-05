// # plop-all-test.ts
import plopAll from '../plop-all-lots.js';
import type { Savegame } from 'sc4/core';
import { resource } from '#test/files.js';
import { expect } from 'chai';

describe('The plopall api function', function() {

	it('plops a single lot', async function() {

		this.timeout(0);

		let city = resource('City - Empty small tile.sc4');
		let diego = resource('DiegoDL-432ParkAvenue-LM-DN');
		let dbpf = await plopAll({
			city,
			lots: '*.SC4Lot',
			directory: diego,
			plugins: diego,
			save: false,
			bbox: [16, 2, 32, 32],
		}) as Savegame;

		let [{ bbox, tract }] = dbpf.buildings;
		expect(bbox.maxX).to.be.at.least(16*16)
		expect(bbox.maxX).to.be.at.most((16+2)*16);
		expect(bbox.maxZ).to.be.at.least(2*16);
		expect(bbox.maxZ).to.be.at.most((2+3)*16);

		expect(tract.min).to.eql({
			x: 0x44,
			z: 0x40,
		});
		expect(tract.max).to.eql({
			x: 0x44,
			z: 0x41,
		});

		let flags = dbpf.terrainFlags;
		expect(flags.raw).to.eql(new Uint16Array(65*65));

	});

});
