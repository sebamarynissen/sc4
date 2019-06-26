// # plop-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const { hex } = require('../lib/util');
const { ZoneType, FileType } = require('../lib/enums');
const Index = require('../lib/index');
const Savegame = require('../lib/savegame');
const LotFile = require('../lib/lot-file');
const BuildingFile = require('../lib/building-file');
const HOME = process.env.HOMEPATH;
const REGION = path.resolve(HOME, 'documents/SimCity 4/regions/experiments');

describe('A city manager', function() {

	it.skip('should plop a building', async function() {

		// Build up an index first of the buildings we're about to use.
		let index = new Index({
			"dirs": [
				path.resolve(__dirname, 'files/DarkNight_11KingStreetWest')
			]
		});
		await index.build();

		// Read in the city as dbpf. Note: we can't get create lot & building 
		// files apparently, so using an already established city with 1 
		// building here.
		let buff = fs.readFileSync(path.resolve(__dirname, 'files/City - Double.sc4'));
		let dbpf = new Savegame(buff);

		// Read the check file so that we can do some diffing.
		let check = new Savegame(fs.readFileSync(path.resolve(__dirname, 'files/City - Double - check.sc4')));
		
		// Loop all files in the dbpf.
		for (let entry of dbpf.entries) {
			let type = entry.type;
			let group = entry.group;
			let instance = entry.instance;

			// Find the corresponding entry.
			let mirror = check.entries.find(entry => {
				return entry.type === type && entry.group === group && entry.instance === instance;
			});
			if (!mirror) {
				console.log(`Found no mirror for ${hex(type)}!`);
				continue;
			}

			// Get both buffers.
			let buff = entry.decompress();
			mirror = mirror.decompress();

			if (buff.byteLength !== mirror.byteLength) {
				// console.log(`Type ${hex(type)}-${hex(group)}-${hex(instance)} has different length.`);
			}

			let a = buff.slice(0, 12).toString('hex');
			let b = mirror.slice(0, 12).toString('hex');
			if (a !== b) {
				// console.log('differ');
				// console.log(`${hex(type)}-${hex(group)}-${hex(instance)}`);
			} else {
				console.log('These are the same');
			}

		}

		return;

		let lotFile = dbpf.lotFile;
		let buildingFile = dbpf.buildingFile;

		expect(lotFile).to.be.ok;
		expect(buildingFile).to.be.ok;

		// It's an empty city, so there are no lot and building file 
		// yet. Create them.
		// if (!lotFile) {
		// 	let tgi = [FileType.LotFile, 0x299b2d1b, 0];
		// 	let entry = dbpf.add(tgi, example.lotFile);
		// 	lotFile = entry.file;
		// }

		// Same for the building file.
		// if (!buildingFile) {
		// 	let tgi = [FileType.BuildingFile, 0x299b2d1b, 0];
		// 	let entry = dbpf.add(tgi, example.buildingFile);
		// 	buildingFile = entry.file;

		// }

		// Get the TGI of the Lot Configuration Exemplar that we're about to 
		// plop.
		let tgi = [0x6534284a, 0xa8fbd372, 0xe001a291];
		let exemplar = index.find(tgi).read();

		// Clone the existing lot.
		// let lot = lotFile.add();
		// Object.assign(lot, lotFile.lots[0]);
		let lot = lotFile.lots[1];
		// lot.mem = Math.floor(Math.random()*0xffffffff);
		// let dx = 5;
		// lot.move([dx, 0]);

		// Clone the existing building.
		let building = buildingFile.buildings[1];
		// building.mem = Math.floor(Math.random()*0xffffffff);
		// building.move([8, 0, 0]);

		// expect(lotFile).to.have.length(2);

		// Now save to the regions folder.
		await dbpf.save({"file": path.join(REGION, 'City - Single.sc4')});

	});

});