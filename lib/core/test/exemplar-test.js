// # exemplar-test.js
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { DBPF } from 'sc4/core';

describe('The Exemplar file', function() {

	it('handles exemplars with multiple DIR entries', function() {

		let dbpf = new DBPF(resource('JLY 747 ACB-VLT Series 3 MMP.dat'));

		// Check an entry in the first DIR.
		let entry = dbpf.find(0x6534284a, 0xe83e0437, 0xfd160370);
		expect(entry.compressed).to.be.true;
		let exemplar = entry.read();
		let value = exemplar.value(0x29244DB5);
		expect(value).to.equal(0x0d);

		// Check an entry in the second DIR.
		entry = dbpf.find(0x6534284a, 0xe83e0437, 0xfd160360);
		expect(entry.compressed).to.be.true;
		exemplar = entry.read();
		value = exemplar.value(0x29244DB5);
		expect(value).to.equal(0x0d);

	});

});
