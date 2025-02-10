// # dbpf-test.ts
import { expect } from 'chai';
import { File, Blob } from 'node:buffer';
import fs from '#test/fs.js';
import { compareUint8Arrays, uint8ArrayToString } from 'uint8array-extras';
import { resource, output } from '#test/files.js';
import {
	FileType,
	DBPF,
	cClass,
    ExemplarProperty,
} from 'sc4/core';
import crc32 from '../crc.js';
import { SmartBuffer } from 'smart-arraybuffer';

describe('A DBPF file', function() {

	it('parses from a file', function() {

		let file = resource('cement.sc4lot');

		// Parse the dbpf.
		let dbpf = new DBPF(file);

		// Find an entry and verify that it gets read correctly.
		let entry = dbpf.find({
			type: 0x6534284a,
			group: 0xa8fbd372,
			instance: 0x8a73e853,
		});
		let exemplar = entry?.read();
		expect(exemplar!.get(0x10)).to.equal(0x10);

	});

	it('parses from a file object', async function() {

		let filePath = resource('cement.sc4lot');
		let buffer = fs.readFileSync(resource('cement.sc4lot'));
		let blob = new Blob([buffer]);
		let file = new File([blob], filePath);
		let dbpf = new DBPF(file);
		await dbpf.parseAsync();

		let entry = dbpf.find({
			type: 0x6534284a,
			group: 0xa8fbd372,
			instance: 0x8a73e853,
		})!;
		let exemplar = await entry.readAsync();
		expect(exemplar.get('ExemplarType')).to.equal(0x10);

	});

	it('parses from a buffer', function() {

		let file = resource('cement.sc4lot');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		// Find an entry and verify that it gets read correctly.
		let entry = dbpf.find({
			type: 0x6534284a,
			group: 0xa8fbd372,
			instance: 0x8a73e853,
		});
		let exemplar = entry?.read();
		expect(exemplar!.get(0x10)).to.equal(0x10);

	});

	it('only reads the header & index initially', function() {

		let file = resource('city.sc4');
		let dbpf = new DBPF({ file });
		expect(dbpf.header.indexCount).to.equal(151);
		expect(dbpf.header.indexOffset).to.equal(7526863);
		expect(dbpf.header.indexSize).to.equal(3020);
		expect(dbpf).to.have.length(151);

	});

	it('asynchronously parses a DBPF', async function() {

		let dbpf = new DBPF({
			file: resource('cement.sc4lot'),
			parse: false,
		});
		await dbpf.parseAsync();

		// Find an entry and verify that it gets read correctly.
		let entry = dbpf.find({
			type: 0x6534284a,
			group: 0xa8fbd372,
			instance: 0x8a73e853,
		});
		let exemplar = entry?.read();
		expect(exemplar!.get(0x10)).to.equal(0x10);

	});

	it('frees memory the DBPF is taking up', function() {

		// Read in the DBPF and make sure all entries are properly read.
		let file = resource('cement.sc4lot');
		let buffer = fs.readFileSync(file);
		let dbpf = new DBPF({ file, buffer });
		expect(dbpf.buffer).to.be.ok;
		for (let entry of dbpf) {
			entry.read();
			expect(entry.raw).to.be.ok;
		}
		let entry = dbpf.find({
			type: 0x6534284a,
			group: 0xa8fbd372,
			instance: 0x8a73e853,
		});

		// Free up the DBPF memory.
		dbpf.free();
		expect(dbpf.buffer).to.be.null;
		for (let entry of dbpf) {
			expect(entry.raw).to.be.null;
			expect(entry.file).to.be.null;
		}

		// Check that the DBPF gets automatically reloaded if we request to 
		// read an entry.
		let exemplar = entry?.read();
		expect(exemplar!.get(0x10)).to.equal(0x10);

	});

	it('correctly serializes to a buffer', function() {
		let file = resource('cement.sc4lot');
		let dbpf = new DBPF(file);

		// Serialize the DBPF into a buffer and immediately parse again so 
		// that we can compare.
		let buff = dbpf.toBuffer();
		expect(uint8ArrayToString(buff.subarray(0, 4))).to.equal('DBPF');
		let my = new DBPF(buff);
		expect(my).to.have.length(dbpf.length);
		
		expect(my.header.created).to.eql(dbpf.header.created);
		expect(my.header.modified).to.eql(dbpf.header.modified);
		for (let entry of my.exemplars) {
			let exemplar = entry.read();
			let { type, group, instance } = entry;
			let check = dbpf.find(type, group, instance)?.read();
			expect(exemplar).to.eql(check);
		}

		my.save(output('saved.sc4lot'));

	});

	it('should find all entries using a checksum', function() {

		let file = resource('city.sc4');
		let dbpf = new DBPF(fs.readFileSync(file));

		let all = [];
		for (let entry of dbpf) {
			let buff = SmartBuffer.fromBuffer(entry.decompress());
			let size = buff.readUInt32LE(0);

			// If what we're interpreting as size is larger than the buffer, 
			// it's impossible that this has the structure size crc mem!
			if (size > buff.length) continue;

			// Calculate the checksum. If it matches the second value, then we 
			// have something of the structure "size crc mem".
			let crc = crc32(entry.decompress(), 8);
			if (crc === buff.readUInt32LE(4)) {
				let type = entry.type;
				let name = cClass[type as keyof typeof cClass].replace(/^cSC4/, '');
				all.push(name);
			}

		}

		// console.log('Thats', all.length/dbpf.entries.length, 'of the entries');

	});

	it('handles files with duplicate entries', function() {

		let dbpf = new DBPF(resource('Airport_Runways_Expandable.dat'));
		let entries = dbpf.findAll({
			type: FileType.Exemplar,
			group: 0xe51b8011,
			instance: 0xce7ae273,
		});
		expect(entries).to.have.length(2);
		let [one, two] = entries.map(x => x.read());
		expect(two.properties).to.have.length.above(one.properties.length);

		let landmarkEffect = two.value(0x2781284F);
		expect(landmarkEffect).to.eql([-40, 64]);

	});

	it('does not perform simultaneous reads', async function() {

		let dbpf = new DBPF(resource('cement.sc4lot'));
		let entry = dbpf.find({ type: FileType.Exemplar })!;
		
		// Read the entry a ton of times. If the read call isn't cached, then 
		// the os will complain about to many file handles.
		let tasks = [];
		for (let i = 0; i < 1e5; i++) {
			tasks.push(entry.readRawAsync());
		}
		const [a, b] = await Promise.all(tasks);
		expect(a).to.equal(b);

	});

	describe('#find()', function() {

		it('finds entries by TGI', function() {

			let dbpf = new DBPF(resource('cement.sc4lot'));
			for (let entry of dbpf) {
				let queried = dbpf.find(entry.type, entry.group, entry.instance);
				expect(queried).to.equal(entry);
			}

		});

		it('automatically figures out the return type of `.read()', function() {

			let dbpf = new DBPF(resource('cement.sc4lot'));
			let entry = dbpf.find({
				type: FileType.Exemplar,
				group: 0x7cc07882
			})!;
			let exemplar = entry.read();
			let type = exemplar.get('ExemplarType');
			expect(type).to.equal(ExemplarProperty.ExemplarType.Buildings);

		});

		it('automatically figures out the return type of `.read()` for arrays', function() {

			let dbpf = new DBPF(resource('City - Historical Town.sc4'));
			let entry = dbpf.find({ type: FileType.Prop })!;
			let props = entry.read();
			expect(props).to.be.an('array');
			for (let prop of props) {
				expect(prop.appearance).to.equal(0x05);
			}

		}); 

	});

	describe('#add()', function() {

		it('adds a raw Uint8Array to a DBPF', function() {

			let dbpf = new DBPF();
			let png = new Uint8Array([
				0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
			]);
			dbpf.add([FileType.PNG, 0x01, 0x02], png);

			let buffer = dbpf.toBuffer();
			let clone = new DBPF(buffer);
			let entry = clone.find(FileType.PNG, 0x01, 0x02);
			expect(compareUint8Arrays(entry!.decompress(), png)).to.equal(0);

		});

	});

});
