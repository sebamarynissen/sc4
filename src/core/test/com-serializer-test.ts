// # com-serializer-file-test.ts
import { expect } from 'chai';
import { compareUint8Arrays } from 'uint8array-extras';
import fs from '#test/fs.js';
import { Savegame, FileType } from 'sc4/core';
import { resource } from '#test/files.js';

describe('The COM serializer file', function() {

	it('should parse & serialize correctly', function() {

		let file = resource('city.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		// Find the com serializer file.
		let entry = dbpf.find({ type: FileType.COMSerializer });
		let com = entry!.read();

		// Assertions.
		expect(com.u1).to.equal(1);
		expect(com.index).to.be.an.instanceOf(Map);

		// Serialize again, buffer should look the same.
		let check = entry!.buffer;
		let buff = com.toBuffer();
		expect(compareUint8Arrays(buff, check!)).to.equal(0);

	});

});
