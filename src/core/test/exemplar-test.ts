// # exemplar-test.ts
import fs from '#test/fs.js';
import { uint8ArrayToHex } from 'uint8array-extras';
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { DBPF, Exemplar, ExemplarProperty, FileType } from 'sc4/core';

describe('The Exemplar file', function() {

	it('should serialize to a buffer correctly', function() {

		// Read an exemplar from a sample dbpf first.
		let file = resource('cement.sc4lot');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let exemplars = dbpf.exemplars;
		let raw = exemplars.map(entry => entry.decompress());

		for (let i = 0; i < exemplars.length; i++) {
			let entry = exemplars[i];
			let exemplar = entry.read();
			let bin = uint8ArrayToHex(exemplar.toBuffer());
			let check = uint8ArrayToHex(raw[i]);
			expect(bin).to.equal(check);
		}

	});

	it('should read textual exemplars', function() {

		let file = resource('quotes.sc4desc');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.exemplars[0];
		entry.read();

	});

	it('handles strings of 0 length', function() {

		let file = resource('zero-length-string.dat');
		let dbpf = new DBPF(file);

		let [entry] = dbpf.exemplars;
		let exemplar = entry.read();
		let str = exemplar.get(0xC98204B9);
		expect(str).to.equal('');

	});

	it('handles exemplars with multiple DIR entries', function() {

		let dbpf = new DBPF(resource('JLY 747 ACB-VLT Series 3 MMP.dat'));

		// Check an entry in the first DIR.
		let entry = dbpf.find(0x6534284a, 0xe83e0437, 0xfd160370);
		expect(entry!.compressed).to.be.true;
		let exemplar = entry!.read();
		let value = exemplar.value(0x29244DB5);
		expect(value).to.equal(0x0d);

		// Check an entry in the second DIR.
		entry = dbpf.find(0x6534284a, 0xe83e0437, 0xfd160360);
		expect(entry!.compressed).to.be.true;
		exemplar = entry!.read();
		value = exemplar.value(0x29244DB5);
		expect(value).to.equal(0x0d);

	});

	it('handles textual exemplars with empty values', function() {

		let dbpf = new DBPF(resource('exemplar edge cases.dat'));

		let entry = dbpf.find(0x6534284a, 0x0e274fb2, 0x30d11119);
		let exemplar = entry!.read();
		let value = exemplar.value(ExemplarProperty.BuildingpropFamily);
		expect(value).to.be.undefined;

	});

	it('handles a textual exemplar with an empty Boolean', function() {

		let dbpf = new DBPF(resource('exemplar edge cases.dat'));
		let entry = dbpf.find(0x6534284a, 0x348c219a, 0xd52e756e);
		let exemplar = entry!.read();

		let value = exemplar.value(ExemplarProperty.kSC4BuildingModelRotationProperty);
		expect(value).to.be.undefined;

	});

	it('reads & serializes LotObjects', function() {

		let dbpf = new DBPF(resource('cement.SC4Lot'));
		let entry = dbpf.find({
			type: FileType.Exemplar,
			group: 0xa8fbd372,
			instance: 0x8a73e853,
		});
		let exemplar = entry!.read();
		let objects = exemplar.lotObjects;
		expect(objects).to.have.length(561);

		// Serialize & then read in again to ensure everything is still correct.
		let buffer = exemplar.toBuffer();
		expect(buffer.byteLength).to.equal(entry!.decompress().byteLength);
		let cloned = new Exemplar(buffer);
		expect(cloned.props).to.have.length(exemplar.props.length);
		for (let prop of exemplar) {
			let clone = cloned.prop(prop.id);
			expect(clone).to.eql(prop);
		}

	});

	it('reads & modifies LotObjects', function() {

		let dbpf = new DBPF(resource('cement.SC4Lot'));
		let entry = dbpf.find({
			type: FileType.Exemplar,
			group: 0xa8fbd372,
			instance: 0x8a73e853,
		});
		let exemplar = entry!.read();
		exemplar.lotObjects = [];

		let clone = new Exemplar(exemplar.toBuffer());
		expect(clone.get(ExemplarProperty.LotConfigPropertyLotObject)).to.be.undefined;
		expect(clone.lotObjects).to.have.length(0);

	});

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
				expect(clone.toBuffer()).to.eql(buffer);
				for (let prop of exemplar) {
					let cloned = clone.prop(prop.id);
					expect(cloned).to.eql(prop);
				}
			}

		});

	});

});
