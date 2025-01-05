// # terrain-flags-test.ts
import { expect } from 'chai';
import { resource } from '#test/files.js';
import Savegame from '../savegame.js';
import FileType from '../file-types.js';
import { compareUint8Arrays } from 'uint8array-extras';

describe('The terrain flags', function() {

	it('parses a tile with holes in the terrain', function() {

		let dbpf = new Savegame(resource('terrain-hole-before.sc4'));
		let entry = dbpf.find({ type: FileType.TerrainFlags })!;
		let flags = entry.read();
		expect(flags.major).to.equal(1);
		for (let z = 0; z < 6; z++) {
			let row = flags.raw.subarray(z*65, (z+1)*65);
			let first = row.subarray(0, 6);
			let rest = row.subarray(6);
			expect([...new Set(first)]).to.eql([0x0200]);
			expect([...new Set(rest)]).to.eql([0x0000]);
		}
		expect(compareUint8Arrays(entry.decompress(), flags.toBuffer())).to.equal(0);

	});

	it('parses a tile without holes in the terrain', function() {

		let dbpf = new Savegame(resource('terrain-hole-after.sc4'));
		let entry = dbpf.find({ type: FileType.TerrainFlags })!;
		let flags = entry.read();
		expect(flags.major).to.equal(1);
		let values = [...new Set(flags.raw)];
		expect(values).to.eql([0]);
		expect(compareUint8Arrays(entry.decompress(), flags.toBuffer())).to.equal(0);

	});

});
