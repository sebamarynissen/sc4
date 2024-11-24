// # file-index-test.js
import { expect } from 'chai';
import Index from '../file-index.js';
import { FileType } from 'sc4/core';
import { resource } from '#test/files.js';

describe('The file index', function() {

	this.slow(1000);

	it('indexes all files in a directory', async function() {

		let index = new Index({
			scan: resource('DarkNight_11KingStreetWest'),
			core: false,
		});

		// Build up the index. This is done asynchronously so that files can 
		// be read in parallel while parsing.
		await index.build();

		let record = index.find(0x6534284a, 0xa8fbd372, 0xe001a291);
		expect(record.fileSize).to.equal(2378);
		expect(record.compressedSize).to.equal(2378);
		expect(record.compressed).to.be.false;

		// Read the file. Should be an exemplar.
		let file = record.read();
		expect(file.fileType).to.equal(FileType.Exemplar);
		expect(file.table).to.have.property('LotConfigPropertyLotObject');
		expect(file.table).to.have.property(0x88EDC900);

		let building = file.lotObjects.find(x => x.type === 0x00);
		expect(building.x).to.equal(1);
		expect(building.y).to.equal(0);
		expect(building.z).to.equal(1.5);

	});

	it('handles non-cohort-parent when reading properties from exemplars', async function() {

		let index = new Index({
			scan: [resource('non-cohort-parent.dat')],
			core: false,
		});
		await index.build();
		let entry = index.find(0x6534284a, 0xcb730fac, 0x54589520);
		let exemplar = entry.read();
		let value = index.getProperty(exemplar, 0x27812870);
		expect(value).to.be.undefined;

	});

	it('uses a memory limit for the cache', async function() {

		let nybt = resource('NYBT/Aaron Graham/NYBT Gracie Manor');
		let index = new Index({
			scan: [nybt],
			mem: 1500000,
			core: false,
		});
		await index.build();
		for (let entry of index) {
			entry.read();
		}

	});

	it('indexes all building and prop families', async function() {

		let nybt = resource('NYBT/Aaron Graham/NYBT Gracie Manor');
		let index = new Index({
			scan: nybt,
			core: false,
		});
		await index.build();
		await index.buildFamilies();
		let { families } = index;
		expect(Object.values(families)).to.have.length(2);
		expect(index.family(0x5484CA20)).to.have.length(4);
		expect(index.family(0x5484CA1F)).to.have.length(4);

	});

	it('serializes & deserializes an index to JSON', async function() {

		let index = new Index({
			scan: resource('NYBT/Aaron Graham/NYBT Gracie Manor'),
			core: false,
		});

		// Build up the index. This is done asynchronously so that files can 
		// be read in parallel while parsing.
		await index.build();
		await index.buildFamilies();

		let json = index.toJSON();
		let clone = await new Index().load(json);
		expect(clone).to.have.length(index.length);
		expect(clone.entries.index).to.be.ok;
		expect(clone.entries.index).to.eql(index.entries.index);

		for (let entry of index) {
			let eq = clone.find(entry.type, entry.group, entry.instance);
			expect(eq.type).to.equal(entry.type);
			expect(eq.group).to.equal(entry.group);
			expect(eq.instance).to.equal(entry.instance);
		}

	});

});
