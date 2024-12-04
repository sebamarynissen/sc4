// # exemplar-test.js
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { DBPF, FileType } from 'sc4/core';
const Props = {
	Family: 0x27812870,
	kSC4BuildingModelRotationProperty: 0xE83A081D,
};

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

	it('handles textual exemplars with empty values', function() {

		let dbpf = new DBPF(resource('exemplar edge cases.dat'));

		let entry = dbpf.find(0x6534284a, 0x0e274fb2, 0x30d11119);
		let exemplar = entry.read();
		let value = exemplar.value(Props.Family);
		expect(value).to.be.undefined;

	});

	it('handles a textual exemplar with an empty Boolean', function() {

		let dbpf = new DBPF(resource('exemplar edge cases.dat'));
		let entry = dbpf.find(0x6534284a, 0x348c219a, 0xd52e756e);
		let exemplar = entry.read();

		let value = exemplar.value(Props.kSC4BuildingModelRotationProperty);
		expect(value).to.be.undefined;

	});

	it.only('reads & serializes LotObjects', function() {

		let dbpf = new DBPF(resource('cement.SC4Lot'));
		let entry = dbpf.find({
			type: FileType.Exemplar,
			group: 0xa8fbd372,
			instance: 0x8a73e853,
		});
		let exemplar = entry.read();
		let objects = exemplar.lotObjects;
		expect(objects).to.have.length(561);
		let buffer = exemplar.toBuffer();
		expect(buffer.byteLength).to.equal(entry.decompress().byteLength);

	});

	it('reads & modifies LotObjects');

	describe('#clone()', function() {

		this.slow(200);

		it('properly clones itself', function() {

			let dbpf = new DBPF(resource('cement.SC4Lot'));
			for (let entry of dbpf.exemplars) {
				let buffer = entry.decompress();
				let exemplar = entry.read();
				let clone = exemplar.clone();
				for (let i = 0; i < exemplar.props.length; i++) {
					let prop = exemplar.props[i];
					let cloned = clone.props[i];
					expect(prop.name).to.equal(cloned.name);
					expect(prop.id).to.equal(cloned.id);
					expect(prop.name).to.eql(cloned.name);
					expect(prop).to.not.equal(cloned);
					if (typeof prop.value === 'object') {
						expect(cloned.value).to.not.equal(prop.value);
						expect(cloned.value).to.deep.equal(prop.value);
					} else {
						expect(cloned.value).to.equal(prop.value);
					}
				}
				expect(Object.keys(exemplar.table)).to.eql(Object.keys(clone.table));
				expect(clone.toBuffer()).to.eql(buffer);
			}

		});

	});

});
