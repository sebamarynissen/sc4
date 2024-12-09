// # crc-test.ts
import { expect } from 'chai';
import { SmartBuffer } from 'smart-arraybuffer';
import crc32 from '../crc.js';

describe('The CRC32 checksum', function() {

	it('calculates crc checksums correctly', function() {

		let buff = SmartBuffer.fromBuffer(new Uint8Array());
		buff.writeFloatLE(Math.PI, 0);
		buff.writeFloatLE(Math.E, 4);

		let crc = crc32(buff.toUint8Array());
		expect(crc).to.equal(0x55ac179c);

	});

});
