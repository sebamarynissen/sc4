// # com-serializer-file-test.js
'use strict';
const { expect } = require('chai');
const fs = require('node:fs');
const { Savegame, FileType } = require('sc4/core');
const resource = require('#test/get-test-file.js');

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