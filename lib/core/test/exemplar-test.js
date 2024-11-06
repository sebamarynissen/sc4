// # exemplar-test.js
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { DBPF } from 'sc4/core';
const Props = {
	Family: 0x27812870,
	kSC4BuildingModelRotationProperty: 0xE83A081D,
};

describe('The Exemplar file', function() {

	it('handles exemplars with multiple DIR entries', function() {

		let dbpf = new DBPF(resource('JLY 747 ACB-VLT Series 3 MMP.dat'));

		// Check an entry in the first DIR.
		let entry = dbpf.get(0x6534284a, 0xe83e0437, 0xfd160370);
		expect(entry.compressed).to.be.true;
		let exemplar = entry.read();
		let value = exemplar.value(0x29244DB5);
		expect(value).to.equal(0x0d);

		// Check an entry in the second DIR.
		entry = dbpf.get(0x6534284a, 0xe83e0437, 0xfd160360);
		expect(entry.compressed).to.be.true;
		exemplar = entry.read();
		value = exemplar.value(0x29244DB5);
		expect(value).to.equal(0x0d);

	});

	it('handles textual exemplars with empty values', function() {

		let dbpf = new DBPF(resource('exemplar edge cases.dat'));

		let entry = dbpf.get(0x6534284a, 0x0e274fb2, 0x30d11119);
		let exemplar = entry.read();
		let value = exemplar.value(Props.Family);
		expect(value).to.be.undefined;

	});

	it('handles a textual exemplar with an empty Boolean', function() {

		let dbpf = new DBPF(resource('exemplar edge cases.dat'));
		let entry = dbpf.get(0x6534284a, 0x348c219a, 0xd52e756e);
		let exemplar = entry.read();

		// console.log(exemplar.value(Props.Family));
		let value = exemplar.value(Props.kSC4BuildingModelRotationProperty);
		expect(value).to.be.undefined;

	});

});
