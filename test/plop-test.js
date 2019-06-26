// # plop-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const crc32 = require('../lib/crc');
const { hex, chunk } = require('../lib/util');
const { ZoneType, FileType, cClass } = require('../lib/enums');
const Index = require('../lib/index');
const Savegame = require('../lib/savegame');
const LotFile = require('../lib/lot-file');
const BuildingFile = require('../lib/building-file');
const HOME = process.env.HOMEPATH;
const REGION = path.resolve(HOME, 'documents/SimCity 4/regions/experiments');

describe('A city manager', function() {

	it.skip('should decode the cSC4Occupant class', function() {

		let buff = fs.readFileSync(path.resolve(REGION, 'City - Textures.sc4'));
		let dbpf = new Savegame(buff);
		let entry = dbpf.entries.find(x => x.type === 0xa9bc9ab6);
		let occ = entry.read();

		// Put in slices.
		let format = '4 4 4 2 4 4 1 1 1 1 2 2 4 4 4 4 4'.split(' ').map(x => 2*(+x));
		let pieces = [];
		while (occ.length > 4) {
			let size = occ.readUInt32LE(0);
			pieces.push(occ.slice(0, size));
			occ = occ.slice(size);
		}

		pieces.map(occ => {
			let crc = occ.readUInt32LE(4);
			expect(crc32(occ, 8)).to.equal(crc);
			console.log(chunk(format, occ.toString('hex')));
		});

		// let index = dbpf.itemIndexFile;
		// console.log(index);

	});

	it.only('should move a building', async function() {

		let buff = fs.readFileSync(path.resolve(__dirname, 'files/City - Move bitch.sc4'));
		let dbpf = new Savegame(buff);

		// Find all entries using a checksum.
		let all = [];
		let mems = new Set();
		for (let entry of dbpf) {
			let buff = entry.decompress();
			let size = buff.readUInt32LE();

			// If what we're interpreting as size is larger than the buffer, 
			// it's impossible that this has the structure size crc mem!
			if (size > buff.byteLength) continue;

			// Calculate the checksum. If it matches the second value, then we 
			// have something of the structure "size crc mem". Perhaps more follow here.
			let crc = crc32(buff, 8);
			if (crc === buff.readUInt32LE(4)) {

				let records = [];
				while (buff.length > 4) {
					let size = buff.readUInt32LE(0);
					records.push(buff.slice(0, size));
					buff = buff.slice(size);
				}

				let type = entry.type;
				for (let record of records) {
					let mem = record.readUInt32LE(8);
					if (mems.has(mem)) {
						console.log('Double memory address!');
					}
					mems.add(mem);
					all.push({
						"mem": mem,
						"type": type,
						"buffer": record
					});
				}
			}

		}

		all.sort(function(a, b) {
			return a.mem - b.mem;
		});

		console.log(all);
		let diffs = all.map((a, i) => {
			let next = all[i+1];
			if (!next) return;
			let diff = next.mem - a.mem;
			if (diff < a.buffer.byteLength) {
				console.log(hex(a.type));
			}
			return diff;
		});

		return;
		// return all;

		// Find the building & lot file.
		let { buildingFile, baseTextureFile, lotFile } = dbpf;
		let lot = lotFile.lots[0];
		let building = buildingFile.buildings[0];
		let tx = baseTextureFile.textures[0];

		const dx = 1;

		// Move the lot 1 to the right so that it stays within its the tract.
		lot.minX += dx;
		lot.maxX += dx;
		lot.commuteX += dx;

		// Move the building as well, but keep it in its tract.
		building.minX += dx*16;
		building.maxX += dx*16;

		// Move the base texture underneath, but again keep it in its tract.
		// tx.minX += dx*16;
		tx.maxX += dx*16;
		let i = 0;
		tx.textures.map(function(tx) {
			if (i++ > 0) return;
			let iid = hex(tx.IID);
			if (tx.priority === 1) {
				tx.x += dx;
			}
		});

		console.log(tx);

		// Decode the index file and find all types we have.
		let index = dbpf.itemIndexFile;
		let cells = index.columns.flat().filter(x => x.length).flat();
		let types = [...new Set(cells.map(item => cClass[item.type]))];
		console.log(types);

		// Now save.
		await dbpf.save({"file": path.join(REGION, 'City - Move bitch.sc4')});

	});

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
		// for (let entry of dbpf.entries) {
		// 	let type = entry.type;
		// 	let group = entry.group;
		// 	let instance = entry.instance;

		// 	// Find the corresponding entry.
		// 	let mirror = check.entries.find(entry => {
		// 		return entry.type === type && entry.group === group && entry.instance === instance;
		// 	});
		// 	if (!mirror) {
		// 		console.log(`Found no mirror for ${hex(type)}!`);
		// 		continue;
		// 	}

		// 	// Get both buffers.
		// 	let buff = entry.decompress();
		// 	mirror = mirror.decompress();

		// 	if (buff.byteLength !== mirror.byteLength) {
		// 		// console.log(`Type ${hex(type)}-${hex(group)}-${hex(instance)} has different length.`);
		// 	}

		// 	let a = buff.slice(0, 12).toString('hex');
		// 	let b = mirror.slice(0, 12).toString('hex');
		// 	if (a !== b) {
		// 		// console.log('differ');
		// 		// console.log(`${hex(type)}-${hex(group)}-${hex(instance)}`);
		// 	} else {
		// 		console.log('These are the same');
		// 	}

		// }

		// return;

		let lotFile = dbpf.lotFile;
		let buildingFile = dbpf.buildingFile;
		let textureFile = dbpf.baseTextureFile;
		let tree = dbpf.itemIndexFile;

		expect(lotFile).to.be.ok;
		expect(buildingFile).to.be.ok;
		expect(textureFile).to.be.ok;
		expect(tree).to.be.ok;

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
		let lot = lotFile.lots[1];
		let dx = 5;
		lot.move([dx, 0]);

		// Clone the existing building.
		let building = buildingFile.buildings[1];
		building.move([dx*16, 0, 0]);

		// Move the texture
		let texture = textureFile.textures[1];
		texture.move([dx, 0]);

		// Rebuild the index.
		tree.rebuild(buildingFile);
		tree.rebuild(textureFile);

		// expect(lotFile).to.have.length(2);

		// Now save to the regions folder.
		await dbpf.save({"file": path.join(REGION, 'City - Single.sc4')});

	});

});