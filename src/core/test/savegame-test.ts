import { expect } from 'chai';
import Savegame from '../savegame.js';
import path from 'node:path';

// # savegame-test.ts
describe('A Savegame', function() {

	describe('#Savegame.create()', function() {

		it('creates an empty savegame', function() {

			const dbpf = Savegame.create({ size: 'small' });
			expect(dbpf.width).to.equal(64);
			expect(dbpf.depth).to.equal(64);

		});

	});

});
