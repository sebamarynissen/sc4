// # lot-developer-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const Savegame = require('../lib/savegame');
const { FileType } = require('../lib/enums');
const { chunk, split } = require('../lib/util');

describe('The LotDeveloper Subfile', function() {

	it('should read small city tiles', function() {
		let file = path.resolve(__dirname, 'files/city - RCI.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let buildings = dbpf.buildingFile.buildings;
		let entry = dbpf.getByType(FileType.LotDeveloperFile);
		let check = entry.decompress();
		let dev = entry.read();
		expect(dev.tileSize).to.equal(64+1);
		expect(dev.buildings).to.have.length(buildings.length);

		let crc = dev.crc;
		let buff = dev.toBuffer();
		expect(buff.readUInt32LE(4)).to.equal(crc);

		// Seems to be something like this:
		// DWORD	Size
		// DWORD	CRC
		// DWORD	Mem
		// WORD	Version
		// DWORD 	City size + 1
		// DWORD	Unknown (seen 0x44800000 and 0x45800000)
		// DWORD	Unknown (seen 0x44800000 and 0x45800000)
		// DWORD	Count (= amount of buildings in the city)
		// 	DWORD	Building pointer
		// 	DWORD	Building type id (0xa9bd882d)
		// DWORD	Unknown (seen 0x00000000)
		// WORD	Unknown (seen 0x00000000)

	});

	it('should read medium city tiles', function() {
		let file = path.resolve(__dirname, 'files/City - Medium.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let buildings = dbpf.buildingFile.buildings;
		let entry = dbpf.getByType(FileType.LotDeveloperFile);
		let check = entry.decompress();
		let dev = entry.read();
		expect(dev.tileSize).to.equal(128+1);
		expect(dev.buildings).to.have.length(buildings.length);

		let crc = dev.crc;
		let buff = dev.toBuffer();
		expect(buff.readUInt32LE(4)).to.equal(crc);

	});

	it('should read large city tiles', function() {
		let file = path.resolve(__dirname, 'files/city.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let buildings = dbpf.buildingFile.buildings;
		let entry = dbpf.getByType(FileType.LotDeveloperFile);
		let check = entry.decompress();
		let dev = entry.read();
		expect(dev.tileSize).to.equal(256+1);
		expect(dev.buildings).to.have.length(buildings.length);

		let crc = dev.crc;
		let buff = dev.toBuffer();
		expect(buff.readUInt32LE(4)).to.equal(crc);

	});

});