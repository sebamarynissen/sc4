// # crc-test.js
import { Buffer } from 'node:buffer';
import { expect } from 'chai';
import crc32 from '../crc.js';

describe('The CRC32 checksum', function() {

	it('calculates crc checksums correctly', function() {

		let buff = Buffer.alloc(8);
		buff.writeFloatLE(Math.PI, 0);
		buff.writeFloatLE(Math.E, 4);

		let crc = crc32(buff);
		expect(crc).to.equal(0x55ac179c);

	});

});
