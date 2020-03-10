// # com-serializer-file-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const path = require('path');
const fs = require('fs');
const crc32 = require('../lib/crc');
const Savegame = require('../lib/savegame');
const { FileType } = require('../lib/enums');

describe('The COM serializer file', function() {

	it('should parse & serialize correctly', function() {

		let file = path.resolve(__dirname, 'files/city.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		// Find the com serializer file.
		let entry = dbpf.getByType(FileType.COMSerializerFile);
		let com = entry.read();
		let raw = entry.decompress();
		let size = raw.readUInt32LE(8);
		
		// console.log(raw.readUInt32LE(8), crc32(raw, 12));

		// Assertions.
		expect(com.u1).to.equal(1);
		expect(com.index).to.be.an.instanceOf(Map);

		// Serialize again, buffer should look the same.
		let check = entry.decompress();
		let buff = com.toBuffer();
		expect(buff.toString('hex')).to.equal(check.toString('hex'));

	});

});