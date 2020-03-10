// # crc-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const crc32 = require('../lib/crc');

describe('The CRC32 checksum', function() {

	it('should calculate crc checksums correctly', function() {

		let buff = Buffer.alloc(8);
		buff.writeFloatLE(Math.PI, 0);
		buff.writeFloatLE(Math.E, 4);

		let crc = crc32(buff);
		expect(crc).to.equal(0x55ac179c);

	});

	it('should support a stream interface', function() {
		let buff = Buffer.alloc(8);
		buff.writeFloatLE(Math.PI, 0);
		buff.writeFloatLE(Math.E, 4);

		let crc = crc32(buff.slice(0, 4), 0);
		crc = crc32(buff.slice(4, 8), 0, crc);

		expect(crc).to.equal(0x55ac179c);

	});

});