import { expect } from 'chai';
import { DBPF, FileType } from 'sc4/core';
import { SmartBuffer } from 'smart-arraybuffer';
import { compareUint8Arrays } from 'uint8array-extras';
import { resource } from '#test/files.js';

describe('The flora subfile', function() {

	it('should be parsed & serialized correctly', function() {

		let dbpf = new DBPF(resource('city - rci.sc4'));

		let entry = dbpf.entries.find({ type: FileType.Flora });
		let flora = entry.read();

		// Check the crc checksums. When we didn't modify a flora item, they 
		// should still match.
		for (let item of flora) {

			let crc = item.crc;
			let buff = SmartBuffer.fromBuffer(item.toBuffer());
			expect(buff.readUInt32LE(4)).to.equal(crc);

		}

		// Serialize the entire file right away. Should result in exactly the 
		// same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer();
		expect(compareUint8Arrays(source, check)).to.equal(0);

	});

});
