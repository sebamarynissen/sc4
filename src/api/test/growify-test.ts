// # growify-test.ts
import { expect } from 'chai';
import { growify } from '../api.js';
import { resource } from '#test/files.js';
import { Savegame } from 'sc4/core';

describe('The growify function', function() {

	it('does not corrupt the save file', async function() {

		let dbpf = await growify({
			dbpf: resource('City - Historical Town.sc4'),
			residential: true,
			commercial: true,
			historical: true,
			save: false,
		});

		let buffer = dbpf.toBuffer();
		let clone = new Savegame(buffer);
		expect(clone.lots).to.have.length(dbpf.lots.length);
		expect(clone.props).to.have.length(dbpf.props.length);
		expect(clone.textures).to.have.length(dbpf.textures.length);

	});

});
