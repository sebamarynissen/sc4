// # dbpf-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');

const { hex, chunk } = require('../lib/util');
const FileType = require('../lib/file-types');
const DBPF = require('../lib/dbpf');
const Savegame = require('../lib/savegame');
const Exemplar = require('../lib/exemplar');
const { ZoneType } = require('../lib/enums');

describe('A DBPF file', function() {

	it('should be parsed', function() {

		let file = path.resolve(__dirname, 'files/cement.sc4lot');
		let buff = fs.readFileSync(file);

		// Parse the dbpf.
		let dbpf = new DBPF(buff);

	});

	it('should be serialized to a buffer', function() {
		let file = path.resolve(__dirname, 'files/cement.sc4lot');
		let dbpf = new DBPF(fs.readFileSync(file));

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

		my.save(path.resolve(__dirname, 'files/saved.sc4lot'));

	});

});

describe('An exemplar file', function() {

	it('should serialize to a buffer correctly', function() {

		// Read an exemplar from a sample dbpf first.
		let file = path.resolve(__dirname, 'files/cement.sc4lot');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let exemplars = dbpf.exemplars;
		let raw = exemplars.map(entry => entry.decompress());

		for (let i = 0; i < exemplars.length; i++) {
			let entry = exemplars[i];
			let exemplar = entry.read()
			let bin = exemplar.toBuffer().toString('hex');
			let check = raw[i].toString('hex');
			expect(bin).to.equal(check);
		}

	});

	it('should read textual exemplars', function() {

		let file = path.resolve(__dirname, 'files/quotes.sc4desc');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.exemplars[0];
		let exemplar = entry.read();

	});

});

describe('A lot subfile', function() {

	it('should be parsed & serialized correctly', function() {

		let file = path.resolve(__dirname, 'files/city.sc4');
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
		let check = lotFile.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

	it('should detect Residential, Commercial, Agricultural & Industry correctly', function() {
		let file = path.resolve(__dirname, 'files/City - RCI.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new Savegame(buff);

		// Get the lotfile.
		let lotFile = dbpf.lotFile;
		let lots = lotFile.lots;
		expect(lots[0].isResidential).to.be.true;
		expect(lots[1].isIndustrial).to.be.true;
		expect(lots[2].isAgricultural).to.be.true;
		expect(lots[2].isIndustrial).to.be.false;
		expect(lots[3].isCommercial).to.be.true;

	});

	it('should re-save after making buildings historical', async function() {
		let file = path.resolve(__dirname, 'files/city.sc4');
		// let file = path.resolve(__dirname, 'files/writing_history.sc4');
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
		let to = path.resolve(__dirname, 'files/writing_true_history.sc4');
		await dbpf.save({"file": to});

		// Now hand-test this in SC4.

	});

	it('should change a plopped building into a grown one', async function() {

		let file = path.resolve(__dirname, 'files/plopped.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		// Read the lots
		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lotFile = entry.read();
		let lots = lotFile.lots;
		let plopped = lots[26];

		plopped.zoneType = 0x01;
		// console.log(hex(plopped.zoneType));
		// console.log(lots)
		// lots[1].zoneType = lots[0].zoneType;

		// Save again.
		let to = path.join(path.dirname(file), 'plopped-mod.sc4');
		await dbpf.save({"file": to});

		// console.log(hex(lots[1].zoneType));
		// console.log(hex(lots[0].zoneType));
		// for (let lot of lotFile) {

		// }

	});

	it('should check for plopped residentials', function() {

		let file = path.resolve(__dirname, 'files/city.sc4');
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
		let file = path.resolve(__dirname, 'files/dumbo-offset.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lotFile = entry.read();

		let lot = lotFile.lots[0];
		lot.minZ += 3;
		lot.maxZ += 3;

		let to = path.join(path.dirname(file), 'dumbo-mod.sc4');
		await dbpf.save({"file": to});

	});

	it('should growify industry', async function() {
		let file = path.resolve(__dirname, 'files/City - Plopped Industry - source.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lotFile = entry.read();

		let lot = lotFile.lots[0];
		expect(lot.isPloppedIndustrial).to.be.true;

		// Now change it and check in SC4.
		lot.zoneType = ZoneType.IMedium;

		let to = path.join(path.dirname(file), 'City - Plopped Industry.sc4');
		await dbpf.save({"file": to});

		// It works!

	});

});

describe('A building subfile', function() {

	it('should be parsed & serialized correctly', function() {
		let file = path.resolve(__dirname, 'files/city.sc4');
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
		let check = buildingFile.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});

describe('A prop subfile', function() {

	it('should be parsed & serialized correctly', function() {
		this.timeout(0);
		let file = path.resolve(__dirname, 'files/city.sc4');
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
		let check = propFile.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});

describe('An item index subfile', function() {

	it('should be parsed & serialized correctly', function() {

		let file = path.resolve(__dirname, 'files/City - RCI.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.ItemIndexFile);
		let indexFile = entry.read();

		expect(indexFile.width).to.equal(1024);
		expect(indexFile.depth).to.equal(1024);
		expect(indexFile.tractWidth).to.equal(16);
		expect(indexFile.tractDepth).to.equal(16);
		expect(indexFile.tileWidth).to.equal(64);
		expect(indexFile.tileDepth).to.equal(64);
		expect(indexFile.columns).to.have.length(192);
		for (let column of indexFile.columns) {
			expect(column).to.have.length(192);
			for (let cell of column) {
				for (let item of cell) {
					expect(item).to.have.property('mem');
					expect(item).to.have.property('type');
				}
			}
		}

		// Now serialize again. We haven't modified anything so everything 
		// should still match.
		let source = entry.decompress();
		let check = indexFile.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});