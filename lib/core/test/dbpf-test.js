// # dbpf-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import { Buffer } from 'buffer';
import { resource, output } from '#test/files.js';

import {
	FileType,
	DBPF,
	Savegame,
	ZoneType,
	TerrainMap,
	cClass,
} from 'sc4/core';
import crc32 from '../crc.js';

describe('A DBPF file', function() {

	it('parses from a file', function() {

		let file = resource('cement.sc4lot');

		// Parse the dbpf.
		let dbpf = new DBPF(file);

		// Find an entry and verify that it gets read correctly.
		let entry = dbpf.find(entry => {
			return (
				entry.type === 0x6534284a &&
				entry.group === 0xa8fbd372 &&
				entry.instance === 0x8a73e853
			);
		});
		let exemplar = entry.read();
		expect(+exemplar.prop(0x10)).to.equal(0x10);

	});

	it('parses from a buffer', function() {

		let file = resource('cement.sc4lot');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		// Find an entry and verify that it gets read correctly.
		let entry = dbpf.find(entry => {
			return (
				entry.type === 0x6534284a &&
				entry.group === 0xa8fbd372 &&
				entry.instance === 0x8a73e853
			);
		});
		let exemplar = entry.read();
		expect(+exemplar.prop(0x10)).to.equal(0x10);

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
		let entry = dbpf.find(entry => {
			return (
				entry.type === 0x6534284a &&
				entry.group === 0xa8fbd372 &&
				entry.instance === 0x8a73e853
			);
		});
		let exemplar = entry.read();
		expect(+exemplar.prop(0x10)).to.equal(0x10);

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
		let entry = dbpf.find(entry => {
			return (
				entry.type === 0x6534284a &&
				entry.group === 0xa8fbd372 &&
				entry.instance === 0x8a73e853
			);
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
		let exemplar = entry.read();
		expect(+exemplar.prop(0x10)).to.equal(0x10);

	});

	it('correctly serializes to a buffer', function() {
		let file = resource('cement.sc4lot');
		let dbpf = new DBPF(file);

		// Serialize the DBPF into a buffer and immediately parse again so 
		// that we can compare.
		let buff = dbpf.toBuffer();
		expect(buff.subarray(0, 4).toString()).to.equal('DBPF');
		let my = new DBPF(buff);
		expect(my).to.have.length(dbpf.length);
		
		expect(my.created).to.eql(dbpf.created);
		expect(my.modified).to.eql(dbpf.modified);
		for (let entry of my.exemplars) {
			let exemplar = entry.read();
			let { type, group, instance } = entry;
			let check = dbpf.find(type, group, instance).read();
			expect(exemplar).to.eql(check);
		}

		my.save(output('saved.sc4lot'));

	});

	it('should find all entries using a checksum', function() {

		let file = resource('city.sc4');
		let dbpf = new DBPF(fs.readFileSync(file));

		let all = [];
		for (let entry of dbpf) {
			let buff = entry.decompress();
			let size = buff.readUInt32LE();

			// If what we're interpreting as size is larger than the buffer, 
			// it's impossible that this has the structure size crc mem!
			if (size > buff.byteLength) continue;

			// Calculate the checksum. If it matches the second value, then we 
			// have something of the structure "size crc mem".
			let crc = crc32(buff, 8);
			if (crc === buff.readUInt32LE(4)) {
				let type = entry.type;
				let name = cClass[type].replace(/^cSC4/, '');
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
		expect(two.props).to.have.length.above(one.props.length);

		let landmarkEffect = two.value(0x2781284F);
		expect(landmarkEffect).to.eql([-40, 64]);

	});

	describe('#find()', function() {

		it('finds entries by TGI', function() {

			let dbpf = new DBPF(resource('cement.sc4lot'));
			for (let entry of dbpf) {
				let queried = dbpf.find(entry.type, entry.group, entry.instance);
				expect(queried).to.equal(entry);
			}

		});

	});

	describe('#add()', function() {

		it('adds a raw buffer to a DBPF', function() {

			let dbpf = new DBPF();
			let png = Buffer.from([
				0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
			]);
			dbpf.add([FileType.PNG, 0x01, 0x02], png);

			let buffer = dbpf.toBuffer();
			let clone = new DBPF(buffer);
			let entry = clone.find(FileType.PNG, 0x01, 0x02);
			expect(Buffer.compare(entry.decompress(), png)).to.equal(0);

		});

		it('adds a raw Uint8Array to a DBPF', function() {

			let dbpf = new DBPF();
			let png = new Uint8Array([
				0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
			]);
			dbpf.add([FileType.PNG, 0x01, 0x02], png);

			let buffer = dbpf.toBuffer();
			let clone = new DBPF(buffer);
			let entry = clone.find(FileType.PNG, 0x01, 0x02);
			expect(Buffer.compare(entry.decompress(), png)).to.equal(0);

		});

	});

});

describe('An exemplar file', function() {

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
			let bin = exemplar.toBuffer().toString('hex');
			let check = raw[i].toString('hex');
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

});

describe('A lot subfile', function() {

	it('should be parsed & serialized correctly', function() {

		let dbpf = new DBPF(resource('city.sc4'));

		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lotFile = entry.read();

		// Check the crc checksums. We didn't modify the lot, so they should 
		// still match. This also ensures that the serialization process is 
		// correct as well!
		for (let lot of lotFile) {

			// Note: toBuffer() updates the crc, so make sure to grab the old 
			// one!
			let crc = lot.crc;
			let buff = lot.toBuffer();
			expect(buff.readUInt32LE(4)).to.equal(crc);

		}

		// Serialize the building file right away. Should result in exactly 
		// the same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

	it('should detect Residential, Commercial, Agricultural & Industry correctly', function() {
		let dbpf = new Savegame(resource('City - RCI.sc4'));

		// Get the lotfile.
		let lots = dbpf.lotFile;
		expect(lots[0].isResidential).to.be.true;
		expect(lots[1].isIndustrial).to.be.true;
		expect(lots[2].isAgricultural).to.be.true;
		expect(lots[2].isIndustrial).to.be.false;
		expect(lots[3].isCommercial).to.be.true;

	});

	it('should re-save after making buildings historical', async function() {
		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		// Mark all lots as historical.
		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lotFile = entry.read();
		for (let lot of lotFile) {
			expect(lot.historical).to.be.false;
			lot.historical = true;
			expect(lot.historical).to.be.true;
		}

		// Save baby. Oh boy oh boy.
		let to = output('writing_true_history.sc4');
		await dbpf.save({ file: to });

		// Now hand-test this in SC4.

	});

	it('should change a plopped building into a grown one', async function() {

		let file = resource('plopped.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		// Read the lots
		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lots = entry.read();
		let plopped = lots[26];

		plopped.zoneType = 0x01;
		// console.log(hex(plopped.zoneType));
		// console.log(lots)
		// lots[1].zoneType = lots[0].zoneType;

		// Save again.
		let to = output('plopped-mod.sc4');
		await dbpf.save({ file: to });

		// console.log(hex(lots[1].zoneType));
		// console.log(hex(lots[0].zoneType));
		// for (let lot of lotFile) {

		// }

	});

	it('should check for plopped residentials', function() {

		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lotFile = entry.read();

		for (let lot of lotFile) {
			expect(lot.isPloppedResidential).to.be.false;
			if (lot.isResidential) {
				lot.zoneType = 0x0f;
				expect(lot.isPloppedResidential).to.be.true;
			}
		}

	});

	it('should move a lot under a bridge', async function() {
		let file = resource('dumbo-offset.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lots = entry.read();

		let lot = lots[0];
		lot.minZ += 3;
		lot.maxZ += 3;

		let to = output('dumbo-mod.sc4');
		await dbpf.save({ file: to });

	});

	it('should growify industry', async function() {
		let file = resource('City - Plopped Industry - source.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lots = entry.read();

		let lot = lots[0];
		expect(lot.isPloppedIndustrial).to.be.true;

		// Now change it and check in SC4.
		lot.zoneType = ZoneType.IMedium;

		let to = output('City - Plopped Industry.sc4');
		await dbpf.save({ file: to });

		// It works!

	});

});

describe('A building subfile', function() {

	it('should be parsed & serialized correctly', function() {
		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.BuildingFile);
		let buildingFile = entry.read();

		// Check the crc checksums. When we didn't modify a building, they 
		// should still match.
		for (let building of buildingFile) {

			// Note: toBuffer() updates the crc, so make sure to grab the old 
			// one!
			let crc = building.crc;
			let buff = building.toBuffer();
			expect(buff.readUInt32LE(4)).to.equal(crc);

		}

		// Serialize the building file right away. Should result in exactly 
		// the same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});

describe('A prop subfile', function() {

	it('should be parsed & serialized correctly', function() {
		this.timeout(0);
		let dbpf = new DBPF(resource('city.sc4'));

		let entry = dbpf.entries.find(x => x.type === FileType.PropFile);
		let propFile = entry.read();

		// Check the crc checksums. When we didn't modify a prop, they should 
		// still match.
		for (let prop of propFile) {

			// Note: toBuffer() updates the crc, so make sure to grab the old
			// one!
			let crc = prop.crc;
			let buff = prop.toBuffer();
			expect(buff.readUInt32LE(4)).to.equal(crc);

		}

		// Serialize the prop file right away. Should result in exactly the 
		// same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

	it('crashes on a poxed city', function() {

		let dbpf = new Savegame(resource('poxed.sc4'));
		expect(() => dbpf.props).to.throw(Error);

	});

});

describe('The flora subfile', function() {

	it('should be parsed & serialized correctly', function() {

		let dbpf = new DBPF(resource('city - rci.sc4'));

		let entry = dbpf.entries.find(x => x.type === FileType.FloraFile);
		let flora = entry.read();

		// Check the crc checksums. When we didn't modify a flora item, they 
		// should still match.
		for (let item of flora) {

			let crc = item.crc;
			let buff = item.toBuffer();
			expect(buff.readUInt32LE(4)).to.equal(crc);

		}

		// Serialize the entire file right away. Should result in exactly the 
		// same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});

describe('The network subfile', function() {

	it('should be parsed & serialized correctly', function() {

		let dbpf = new DBPF(resource('city.sc4'));

		let entry = dbpf.entries.find(x => x.type === FileType.NetworkFile);
		let network = entry.read();

		// Check the crc checksums. When we didn't modify a network tile, they 
		// should still match.
		for (let tile of network) {
			let crc = tile.crc;
			let buff = tile.toBuffer();
			expect(buff.readUInt32LE(4)).to.equal(crc);
		}

		// Serialize the entire file right away. Should result in exactly the 
		// same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});

describe('A terrain map', function() {

	it('should read the terrain correctly', function() {

		let dbpf = new DBPF(resource('City - RCI.sc4'));

		// Read the region data.
		let regionData = dbpf.entries.find(x => x.type===FileType.RegionViewFile).read();

		// Read the terrain as well;
		let entry = dbpf.entries.find(function(entry) {
			return entry.type === 0xa9dd6ff4 && entry.group === 0xe98f9525 && entry.instance === 0x00000001;
		});
		let map = new TerrainMap(regionData.xSize, regionData.ySize);
		map.parse(entry.decompress());

	});

});
