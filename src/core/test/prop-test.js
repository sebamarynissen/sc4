import { expect } from 'chai';
import { DBPF, Savegame, FileType } from 'sc4/core';
import { SmartBuffer } from 'smart-arraybuffer';
import { compareUint8Arrays } from 'uint8array-extras';
import { resource } from '#test/files.js';

describe('A prop subfile', function() {

	it('should be parsed & serialized correctly', function() {
		this.timeout(0);
		let dbpf = new DBPF(resource('city.sc4'));

		let entry = dbpf.entries.find({ type: FileType.Prop });
		let propFile = entry.read();

		// Check the crc checksums. When we didn't modify a prop, they should 
		// still match.
		for (let prop of propFile) {

			// Note: toBuffer() updates the crc, so make sure to grab the old
			// one!
			let crc = prop.crc;
			let buff = SmartBuffer.fromBuffer(prop.toBuffer());
			expect(buff.readUInt32LE(4)).to.equal(crc);

		}

		// Serialize the prop file right away. Should result in exactly the 
		// same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer();
		expect(compareUint8Arrays(source, check)).to.equal(0);

	});

	it('crashes on a poxed city', function() {

		let dbpf = new Savegame(resource('poxed.sc4'));
		expect(() => dbpf.props).to.throw(Error);

	});

});
