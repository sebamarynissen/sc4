import { expect } from 'chai';
import { DBPF, FileType, Savegame } from 'sc4/core';
import { SmartBuffer } from 'smart-arraybuffer';
import { compareUint8Arrays } from 'uint8array-extras';
import fs from '#test/fs.js';
import { resource } from '#test/files.js';

describe('A building subfile', function() {

	it('should be parsed & serialized correctly', function() {
		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.find({ type: FileType.Building });

		// Check the crc checksums. When we didn't modify a building, they 
		// should still match.
		for (let building of entry!.read()) {

			// Note: toBuffer() updates the crc, so make sure to grab the old 
			// one!
			let crc = building.crc;
			let buff = SmartBuffer.fromBuffer(building.toBuffer());
			expect(buff.readUInt32LE(4)).to.equal(crc);

		}

		// Serialize the building file right away. Should result in exactly 
		// the same buffer.
		let source = entry!.decompress();
		let check = entry!.toBuffer();
		expect(compareUint8Arrays(source, check!)).to.equal(0);

	});

	it('properly parses the bbox', function() {

		let { buildings } = new Savegame(resource('city.sc4'));
		for (let building of buildings) {
			let { min, max } = building.bbox;
			for (let i = 0; i < min.length; i++) {
				expect(min[i]).to.be.at.most(max[i]);
			}
		}

	});

});
