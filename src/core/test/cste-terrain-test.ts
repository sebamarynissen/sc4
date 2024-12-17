import { resource } from '#test/files.js';
import { expect } from 'chai';
import crc from '../crc.js';
import FileType from '../file-types.js';
import Savegame from '../savegame.js';
import { compareUint8Arrays } from 'uint8array-extras';

// # cste-terrain-test.ts
describe('The cSTETerrain subfile', function() {

	it('is parsed & serialized correctly', function() {

		let dbpf = new Savegame(resource('City - Large developed.sc4'));
		let entry = dbpf.find({ type: FileType.cSTETerrain })!;
		let terrain = entry.read();
		let buffer = entry.decompress();
		expect(crc(buffer.subarray(8))).to.equal(terrain.crc);

		let generated = terrain.toBuffer();
		expect(compareUint8Arrays(generated, buffer)).to.equal(0);

	});

});
