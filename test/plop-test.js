// # plop-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const api = require('../lib');
const Stream = require('../lib/stream');
const crc32 = require('../lib/crc');
const { hex, chunk, split } = require('../lib/util');
const { ZoneType, FileType, cClass, SimGrid } = require('../lib/enums');
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

	it.skip('should plop a new lot', async function() {

		function clone(obj) {
			return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
		}

		let buff = fs.readFileSync(path.resolve(__dirname, 'files/City - Move bitch.sc4'));
		let dbpf = new Savegame(buff);

		let index = dbpf.itemIndexFile;

		// Step 1: create a new lot and put it in the zone developer.
		let lots = dbpf.lotFile.lots;
		let source = lots[0];

		// Create the new lot and add it to the lots as well and add to the 
		// **zone developer**.
		let lot = clone(source);
		lot.mem += 4;
		lot.minX = 2;
		lot.maxX = 2;
		lot.commuteX = 2;
		// lot.dateCreated = 2451552;
		// lot.debug = 40;
		lots.push(lot);

		// Clone it's sgprops as well.
		lot.sgprops = lot.sgprops.map(clone);
		lot.jobCapacities = lot.jobCapacities.map(clone);
		lot.jobTotalCapacities = lot.jobTotalCapacities.map(clone);

		// // We found a diff in the sgprops, see if this fixes it.
		// // lot.sgprops[0].value = 6;
		// // lot.sgprops[1].value = 3;

		// Remember! This goes per **tile**! Not per tract!
		let dev = dbpf.zoneDeveloperFile;
		for (let x = lot.minX; x <= lot.maxX; x++) {
			for (let z = lot.minZ; z <= lot.maxZ; z++) {
				dev.cells[x][z] = {
					"mem": lot.mem,
					"type": FileType.LotFile
				};
			}
		}

		// Create the building on the new lot.
		let buildings = dbpf.buildingFile.buildings;
		source = buildings[0];
		let building = clone(source);
		building.mem += 4;
		building.minX += 2*16;
		building.maxX += 2*16;
		buildings.push(building);
		index.columns[64][64].push({
			"mem": building.mem,
			"type": FileType.BuildingFile
		});

		// Add the building to the lot developer.
		dev = dbpf.lotDeveloperFile;
		dev.buildings.push({
			"mem": building.mem,
			"type": FileType.BuildingFile
		});

		// Now add the texture as well.
		let txs = dbpf.baseTextureFile.textures;
		source = txs[0];

		// Don't forget that the textures array needs to be cloned as well!
		let tx = clone(source);
		tx.textures = tx.textures.map(clone);
		tx.mem += 4;
		tx.minX += 2*16;
		tx.maxX += 2*16
		tx.textures.forEach(function(tx) {
			tx.x += 2;
		});
		// tx.textures[0].u7 = 1;
		txs.push(tx);

		// Add to the item index.
		index.columns[64][64].push({
			"mem": tx.mem,
			"type": FileType.BaseTextureFile
		});

		// Read in the UInt8 simgrids and check if we can do something with it.
		let grids = dbpf.getByType(FileType.SimGridUint8).read();

		// Find all grids that only have 1 non-zero entry.
		// Yeah it definitely does do something, but we will have to run an 
		// established city through it to get some results here.
		for (let grid of grids) {
			for (let i = 0; i < grid.data.length; i++) {
				grid.data[i] = 0xff;
			}
			// let n = 0;
			// for (let value of grid.data) {
			// 	if (value) n++;
			// }
			// if (n === 1) {
			// 	let max = Math.max(...grid.data);
			// 	for (let i = 0; i < grid.data.length; i++) {
			// 		grid.data[i] = max;
			// 	}
			// }
		}

		// Loop all grids and find those that only have 1 as max value.
		// for (let grid of grids) {
		// 	let max = Math.max(...grid.data);
		// 	if (max === 1) {
		// 		console.log(hex(grid.dataId));
		// 	}
		// }

		// let power = grids.get(SimGrid.Power);
		// for (let i = 0; i < power.data.length; i++) {
		// 	power.data[i] = 1;
		// }

		// Time for action: save!
		await dbpf.save({"file":path.resolve(REGION,'City - Move bitch.sc4')});
		// await dbpf.save({"file":path.resolve(__dirname,'files/City - Move bitch - generated.sc4')});

	});

	it.only('should play with the grids in an established city', async function() {

		let buff = fs.readFileSync(path.resolve(__dirname, 'files/City - Established.sc4'));
		let dbpf = new Savegame(buff);

		let all = [
			FileType.SimGridUint8,
			FileType.SimGridSint8,
			FileType.SimGridUint16,
			FileType.SimGridSint16,
			FileType.SimGridUint32,
			FileType.SimGridFloat32
		];
		for (let type of all) {
			let grids = dbpf.getByType(type).read();
			for (let grid of grids) {
				for (let i = 0; i < grid.data.length; i++) {
					grid.data[i] = 0;
				}
			}
		}

		await dbpf.save({"file":path.resolve(REGION,'City - Established.sc4')});

	});

	it.skip('should move a building', async function() {

		let buff = fs.readFileSync(path.resolve(__dirname, 'files/City - Move bitch.sc4'));
		let dbpf = new Savegame(buff);

		// Find the building & lot file.
		let { buildingFile, baseTextureFile, lotFile } = dbpf;
		let lot = lotFile.lots[0];

		const dx = 2;

		// Move the lot.
		lot.minX += dx;
		lot.maxX += dx;
		lot.commuteX += dx;

		// Move the building.
		let building = buildingFile.buildings[0];
		building.minX += 16*dx;
		building.maxX += 16*dx;

		// Move the texture.
		let tx = baseTextureFile.textures[0];
		tx.minX += 16*dx;
		tx.maxX += 16*dx;
		tx.textures.map(function(tile) {
			tile.x += 1*dx;
		});

		// Now save and see what happens.
		await dbpf.save({"file": path.join(REGION, 'City - Move bitch.sc4')});

	});

	it.skip('should decode the cSC4SimGridUint8', function() {

		let source = path.resolve(REGION, 'City - Grid.sc4');
		// let source = path.resolve(__dirname, 'files/city.sc4');
		let dbpf = new Savegame(fs.readFileSync(source));

		// Find the entry.

		// cSC4SimGridUInt8
		let entry = dbpf.entries.find(x => x.type === 0x49b9e602);

		// cSC4SimGridSInt8
		// let entry = dbpf.entries.find(x => x.type === 0x49b9e603);

		// cSC4SimGridUint32
		// let entry = dbpf.entries.find(x => x.type === 0x49b9e606);

		// cSC4SimGridFloat32
		// let entry = dbpf.entries.find(x => x.type === 0x49b9e60a);

		let buff = entry.read();
		let buffs = split(buff);
		let target = buffs[0];

		let header = target.slice(0, 55);
		let format = '4 4 4 2 1 4 4 4 4 4 4 2 1 4 4'.split(' ').map(x => 2*x);

		console.log(header);

		// console.log(chunk(format, target.slice(0, headerLength).toString('hex')));

		// console.log('rest', target.slice(headerLength).toString('hex'));

		// Loop all buffers and create a grid from it.
		for (let i = 0; i < buffs.length; i++) {

			let buff = buffs[i];
			let slice = buff.slice(55);
			let rs = new Stream(slice);
			let sqrt = Math.sqrt(slice.byteLength);

			let grid = new Array(sqrt);
			for (let x = 0; x < sqrt; x++) {
				let column = grid[x] = new Array(sqrt);
				for (let z = 0; z < sqrt; z++) {
					column[z] = rs.byte();
					// column[z] = rs.dword();
				}
			}

			let str = '';
			for (let z = 0; z < sqrt; z++) {
				for (let x = 0; x < sqrt; x++) {
					str += grid[x][z] ? 'x' : '.';
				}
				str += '\n';
			}
			console.log(str);

		}

		// Check the second buffer as well.
		// console.log(buffs);

	});

});