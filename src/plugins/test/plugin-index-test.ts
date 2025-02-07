// # file-index-test.js
import path from 'node:path';
import { expect } from 'chai';
import Index from '../plugin-index.js';
import { FileType } from 'sc4/core';
import { resource } from '#test/files.js';

describe('The plugin index', function() {

	it('indexes all files in a directory', async function() {

		let index = new Index({
			plugins: resource('DarkNight_11KingStreetWest'),
			core: false,
		});

		// Build up the index. This is done asynchronously so that files can 
		// be read in parallel while parsing.
		await index.build();

		let record = index.find(0x6534284a, 0xa8fbd372, 0xe001a291)!;
		expect(record.fileSize).to.equal(2378);
		expect(record.compressedSize).to.equal(2378);
		expect(record.compressed).to.be.false;

		// Read the file. Should be an exemplar.
		let file = record.read();
		expect(file.fileType).to.equal(FileType.Exemplar);
		expect(file.prop(0x88EDC900)).to.be.ok;

		let building = file.lotObjects.find(x => x.type === 0x00)!;
		expect(building.x).to.equal(16);
		expect(building.y).to.equal(0);
		expect(building.z).to.equal(24);

	});

	it('handles non-cohort-parent when reading properties from exemplars', async function() {

		let index = new Index({
			scan: 'non-cohort-parent.dat',
			plugins: resource('.'),
			core: false,
		});
		await index.build();
		let entry = index.find(0x6534284a, 0xcb730fac, 0x54589520)!;
		let exemplar = entry.read();
		let value = index.getProperty(exemplar, 0x27812870);
		expect(value).to.be.undefined;

	});

	it('uses a memory limit for the cache', async function() {

		let nybt = resource('NYBT/Aaron Graham/NYBT Gracie Manor');
		let index = new Index({
			plugins: nybt,
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
			plugins: nybt,
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
			plugins: resource('NYBT/Aaron Graham/NYBT Gracie Manor'),
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
			let eq = clone.find(entry.type, entry.group, entry.instance)!;
			expect(eq.type).to.equal(entry.type);
			expect(eq.group).to.equal(entry.group);
			expect(eq.instance).to.equal(entry.instance);
		}

	});

	it('keeps overridden files in the index', async function() {

		let index = new Index({
			plugins: resource('overrides'),
			core: false,
		});
		await index.build();

		let entries = index.findAll({
			type: FileType.Exemplar,
			group: 0x947da1d3,
			instance: 0x59668597,
		});
		expect(entries).to.have.length(2);
		let last = index.find({
			type: FileType.Exemplar,
			group: 0x947da1d3,
			instance: 0x59668597,
		})!;
		expect(path.basename(last.dbpf.file!)).to.equal('z_override.SC4Desc');

	});

	it('properly handles compressed/non-compressed duplicates', async function() {

		let index = new Index({
			plugins: resource('duplicates'),
			core: false,
		});
		await index.build();
		await index.buildFamilies();
		expect(index.entries).to.have.length(2);

	});

});
