// # com-serializer-file-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import { Savegame, FileType } from 'sc4/core';
import resource from '#test/get-test-file.js';

describe('The COM serializer file', function() {

	it('should parse & serialize correctly', function() {

		let file = resource('city.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		// Find the com serializer file.
		let entry = dbpf.getByType(FileType.COMSerializerFile);
		let com = entry.read();

		// Assertions.
		expect(com.u1).to.equal(1);
		expect(com.index).to.be.an.instanceOf(Map);

		// Serialize again, buffer should look the same.
		let check = entry.buffer;
		let buff = com.toBuffer();
		expect(buff.toString('hex')).to.equal(check.toString('hex'));

	});

});
