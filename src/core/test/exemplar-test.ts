// # exemplar-test.ts
import fs from '#test/fs.js';
import { uint8ArrayToHex } from 'uint8array-extras';
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { DBPF, Exemplar, ExemplarProperty, FileType, TGI } from 'sc4/core';

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

	it('reads textual exemplars', function() {

		let file = resource('quotes.sc4desc');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.exemplars[0];
		let exemplar = entry.read();
		let pollution = exemplar.get('PollutionAtCenter');
		expect(pollution).to.eql([1, 1, 4, 0]);

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
		let entry = dbpf.find(0x6534284a, 0xe83e0437, 0xfd160370)!;
		let exemplar = entry.read();
		let value = exemplar.value(0x29244DB5);
		expect(value).to.equal(0x0d);

		// Check an entry in the second DIR.
		entry = dbpf.find(0x6534284a, 0xe83e0437, 0xfd160360)!;
		exemplar = entry.read();
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

	it('handles an exemplar where the property count is incorrect', function() {

		let dbpf = new DBPF(resource('Escola primaria.dat'));
		let entry = dbpf.find(0x6534284a, 0x33f97f68, 0x147ada3c)!;
		let exemplar = entry.read();
		expect(exemplar.properties).to.have.length(35);

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
		expect(cloned.properties).to.have.length(exemplar.properties.length);
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

	it('converts numbers to bigints if that\'s the type', function() {

		let exemplar = new Exemplar({
			properties: [
				{
					id: +ExemplarProperty.BulldozeCost,
					type: 'Sint64',
					value: 10,
				},
			],
		});
		let [prop] = exemplar;
		expect(prop.value).to.equal(10n);

	});

	describe('#constructor()', function() {

		it('constructs from JSON', function() {

			let [type, group, instance] = TGI.random(FileType.Cohort);
			let exemplar = new Exemplar({
				parent: [type, group, instance],
				properties: [
					{
						id: +ExemplarProperty.ExemplarType,
						value: 0x21,
						type: 'Uint32',
					},
					{
						id: +ExemplarProperty.ExemplarName,
						value: 'Exemplar name',
						type: 'String',
					},
					{
						id: +ExemplarProperty.OccupantSize,
						value: [10, Math.PI, 5],
						type: 'Float32',
					},
					{
						id: +ExemplarProperty.MonthlyConstantIncome,
						value: 200,
						type: 'Sint64',
					},
				],
			});
			expect(exemplar.parent).to.eql(new TGI(type, group, instance));
			expect(exemplar.get('ExemplarType')).to.equal(0x21);
			expect(exemplar.get('ExemplarName')).to.equal('Exemplar name');
			expect(exemplar.get('OccupantSize')).to.eql([10, Math.PI, 5]);
			expect(exemplar.get('MonthlyConstantIncome')).to.equal(200n);

		});

		it('figures out the type from known exemplar properties if not specified explicitly', function() {

			let exemplar = new Exemplar({
				properties: [
					{
						id: +ExemplarProperty.MediumWealthEQ,
						value: 0xfe,
					},
				],
			});
			let prop = exemplar.prop('MediumWealthEQ')!;
			expect(prop.type).to.equal('Uint8');
			expect(prop.value).to.equal(0xfe);

		});

	});

	describe('#get()', function() {

		it('automatically unwraps single-value arrays for non-array properties', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty({
				id: 'ExemplarType',
				value: [0x1234567],
			} as any);
			expect(exemplar.get(0x10)).to.equal(0x1234567);

		});

		it('automatically wraps array-values in arrays when not in an array', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('ResourceKeyType4', 0x1234567 as any);
			expect(exemplar.get('ResourceKeyType4')).to.eql([0x1234567]);

		});

	});

	describe('#addProperty()', function() {

		it('automatically sets the correct type for a known property', function() {

			const exemplar = new Exemplar();
			exemplar.addProperty('Purpose', ExemplarProperty.Purpose.Manufacturing);

			const prop = exemplar.prop('Purpose')!;
			expect(prop.type).to.equal('Uint8');

		});

	});

	describe('#set()', function() {

		it('modifies an existing property', function() {

			const exemplar = new Exemplar();
			const prop = exemplar.addProperty('AllowJointOccupancy', true);
			expect(prop.value).to.be.true;
			exemplar.set('AllowJointOccupancy', false);
			expect(prop.value).to.be.false;
			expect(exemplar.properties).to.have.length(1);

		});

		it('adds the property if it does not exist yet', function() {

			const exemplar = new Exemplar();
			exemplar.set('Purpose', ExemplarProperty.Purpose.HighTech);

			const prop = exemplar.prop('Purpose')!;
			expect(prop).to.be.ok;
			expect(prop.value).to.equal(ExemplarProperty.Purpose.HighTech);
			expect(prop.type).to.equal('Uint8');

		});

	});

	describe('#unset()', function() {

		it('removes an existing property', function() {

			const exemplar = new Exemplar();
			exemplar.addProperty('LotResourceKey', 0x01234567);
			expect(exemplar.properties).to.have.length(1);
			expect(exemplar.get('LotResourceKey')).to.be.ok;

			exemplar.unset('LotResourceKey');
			expect(exemplar.properties).to.have.length(0);
			expect(exemplar.prop('LotResourceKey')).to.be.undefined;

		});

	});

	describe('#clone()', function() {

		this.slow(200);

		it('properly clones itself', function() {

			let dbpf = new DBPF(resource('cement.SC4Lot'));
			for (let entry of dbpf.exemplars) {
				let buffer = entry.decompress();
				let exemplar = entry.read();
				let clone = exemplar.clone();
				for (let i = 0; i < exemplar.properties.length; i++) {
					let prop = exemplar.properties[i];
					let cloned = clone.properties[i];
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

	describe('#toJSON()', function() {

		it('serializes to JSON', function() {

			let exemplar = new Exemplar({
				parent: [FileType.Cohort, 0x01234567, 0xfedcba98],
				properties: [
					{
						id: +ExemplarProperty.ExemplarType,
						type: 'Uint32',
						value: 0x21,
					},
					{
						id: +ExemplarProperty.BulldozeCost,
						type: 'Sint64',
						value: 46723n,
					},
					{
						id: +ExemplarProperty.ItemDescription,
						type: 'String',
						value: 'This is a description',
					},
					{
						id: +ExemplarProperty.OccupantSize,
						type: 'Float32',
						value: [10.5, 3.5, 2.75],
					},
				],
			});
			let json = exemplar.toJSON();
			expect(json).to.eql({
				parent: [FileType.Cohort, 0x01234567, 0xfedcba98],
				properties: [
					{
						id: +ExemplarProperty.ExemplarType,
						type: 'Uint32',
						name: 'ExemplarType',
						value: 0x21,
					},
					{
						id: +ExemplarProperty.BulldozeCost,
						type: 'Sint64',
						name: 'BulldozeCost',
						value: 46723n,
					},
					{
						id: +ExemplarProperty.ItemDescription,
						type: 'String',
						name: 'ItemDescription',
						value: 'This is a description',
					},
					{
						id: +ExemplarProperty.OccupantSize,
						type: 'Float32',
						name: 'OccupantSize',
						value: [10.5, 3.5, 2.75],
					},
				],
			});

		});

	});

});
