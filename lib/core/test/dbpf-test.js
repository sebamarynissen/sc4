// # dbpf-test.js
'use strict';
const { expect } = require('chai');
const fs = require('node:fs');
const path = require('node:path');
const resource = require('#test/get-test-file.js');

const {
	FileType,
	DBPF,
	Savegame,
	ZoneType,
	TerrainMap,
} = require('sc4/core');
const { cClass } = require('../enums.js');
const crc32 = require('../crc.js');

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

	it('frees memory the DBPF is taking up', function() {

		// Read in the DBPF and make sure all entries are properly read.
		let file = resource('cement.sc4lot');
		let dbpf = new DBPF(file);
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

	it('should be serialized to a buffer', function() {
		let file = resource('cement.sc4lot');
		let dbpf = new DBPF(file);

		// Serialize the DBPF into a buffer and immediately parse again so 
		// that we can compare.
		let buff = dbpf.toBuffer();
		let my = new DBPF(buff);
		
		expect(my.created).to.eql(dbpf.created);
		expect(my.modified).to.eql(dbpf.modified);
		for (let entry of my.exemplars) {
			let exemplar = entry.read();
			let check = dbpf.index.get(entry.id).read();
			expect(exemplar).to.eql(check);
		}

		my.save(resource('saved.sc4lot'));

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

		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

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
		let file = resource('City - RCI.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new Savegame(buff);

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
		// let file = resource('writing_history.sc4');
		// let file = path.resolve(process.env.HOMEPATH, 'documents/SimCity 4/Regions/Experiments/City - Writing More History.sc4');
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
		let to = resource('writing_true_history.sc4');
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
		let to = path.join(path.dirname(file), 'plopped-mod.sc4');
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

		let to = path.join(path.dirname(file), 'dumbo-mod.sc4');
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

		let to = path.join(path.dirname(file), 'City - Plopped Industry.sc4');
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
		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

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

		let file = resource('poxed.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new Savegame(buff);
		expect(() => dbpf.props).to.throw(Error);

	});

});

describe('The flora subfile', function() {

	it('should be parsed & serialized correctly', function() {

		let file = resource('city - rci.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

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

		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

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

		let file = resource('City - RCI.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

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
