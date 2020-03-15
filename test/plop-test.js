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
const CityManager = require('../lib/city-manager.js');
const FileIndex = require('../lib/file-index.js');
const Savegame = require('../lib/savegame');
const Lot = require('../lib/lot');
const Building = require('../lib/building');
const skyline = require('../lib/skyline.js');
const HOME = process.env.HOMEPATH;
const PLUGINS = path.resolve(HOME, 'documents/SimCity 4/plugins');
const REGION = path.resolve(HOME, 'documents/SimCity 4/regions/experiments');
const c = 'c:/GOG Games/SimCity 4 Deluxe Edition';

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
		let lots = dbpf.lotFile;
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
		let buildings = dbpf.buildingFile;
		source = buildings[0];
		let building = clone(source);
		building.mem += 4;
		building.minX += 2*16;
		building.maxX += 2*16;
		buildings.push(building);
		index[64][64].push({
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
		let txs = dbpf.baseTextureFile;
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
		index[64][64].push({
			"mem": tx.mem,
			"type": FileType.BaseTextureFile
		});

		// Now update the com serializer as well.
		let com = dbpf.COMSerializerFile;
		com.set(FileType.LotFile, lots.length);
		com.set(FileType.BuildingFile, buildings.length);
		com.set(FileType.BaseTextureFile, txs.length);

		// Time for action: save!
		await dbpf.save({"file":path.resolve(REGION,'City - Move bitch.sc4')});

	});

	it.skip('should play with the grids in an established city', async function() {

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

	it.skip('should create flora', async function() {

		let buff = fs.readFileSync(path.resolve(__dirname, 'files/City - Flora.sc4'));
		let dbpf = new Savegame(buff);

		let { floraFile, itemIndexFile, COMSerializerFile } = dbpf;
		let tree = floraFile[0];

		floraFile.length = 0;
		itemIndexFile[64][64].length = 0;

		let mem = tree.mem;
		for (let i = 0; i < 64; i++) {
			for (let j = 0; j < 64; j++) {

				if (i === j) continue;

				let clone = Object.create(Object.getPrototypeOf(tree), Object.getOwnPropertyDescriptors(tree));
				clone.mem = mem += 4;
				clone.x = 16*i+8;
				clone.z = 16*j+8;

				let xx = 64 + Math.floor(clone.x / 64);
				let zz = 64 + Math.floor(clone.z / 64);

				floraFile.push(clone);
				itemIndexFile[xx][zz].push({
					"mem": clone.mem,
					"type": clone.type
				});

			}
		}

		COMSerializerFile.set(FileType.FloraFile, floraFile.length);
		// console.log(COMSerializerFile.get(FileType.FloraFile));
		console.log(COMSerializerFile);

		await dbpf.save({"file": path.resolve(REGION, 'City - Flora.sc4')});

	});

	// Beware!! If the tracts are not set correctly we've created immortal 
	// flora. Probably when deleting within a tract the game only looks for 
	// stuff in that tract. That's quite logical actually.
	it.skip('should create forested streets', async function() {

		let buff = fs.readFileSync(path.resolve(__dirname, 'files/City - Million Trees.sc4'));
		let dbpf = new Savegame(buff);

		let { floraFile, itemIndexFile, COMSerializerFile } = dbpf;

		let mem = 1;
		function clone(nr) {
			let tree = floraFile[nr];
			let proto = Object.getPrototypeOf(tree);
			let props = Object.getOwnPropertyDescriptors(tree);
			tree = Object.create(tree, props);
			tree.mem = mem++;
			return tree;
		}

		// Create some trees on the street.
		for (let i = 0; i < 10; i++) {
			for (let j = 0; j < 2; j++) {
				let tree = clone( Math.floor(2*Math.random()) );
				tree.x = 16*17 + 16*i + 8;
				tree.z = 16*10 + (j === 0 ? 2 : 14);
				floraFile.push(tree);
				let xx = 64 + Math.floor(tree.x / 64);
				let zz = 64 + Math.floor(tree.z / 64);
				tree.xMinTract = tree.xMaxTract = xx;
				tree.zMinTract = tree.zMaxTract = zz;
				itemIndexFile[xx][zz].push({
					"mem": tree.mem,
					"type": FileType.FloraFile
				});
			}
		}

		COMSerializerFile.set(FileType.FloraFile, floraFile.length);

		await dbpf.save({"file": path.resolve(REGION, 'City - Million Trees.sc4')});

	});

	it.skip('should move a building', async function() {

		let buff = fs.readFileSync(path.resolve(__dirname, 'files/City - Move bitch.sc4'));
		let dbpf = new Savegame(buff);

		// Find the building & lot file.
		let { buildingFile, baseTextureFile, lotFile } = dbpf;
		let lot = lotFile[0];

		const dx = 2;

		// Move the lot.
		lot.minX += dx;
		lot.maxX += dx;
		lot.commuteX += dx;

		// Move the building.
		let building = buildingFile[0];
		building.minX += 16*dx;
		building.maxX += 16*dx;

		// Move the texture.
		let tx = baseTextureFile[0];
		tx.minX += 16*dx;
		tx.maxX += 16*dx;
		tx.textures.map(function(tile) {
			tile.x += 1*dx;
		});

		// Now save and see what happens.
		await dbpf.save({"file": path.join(REGION, 'City - Move bitch.sc4')});

	});

	it.only('builds a skyline', async function() {

		this.timeout(0);

		let dir = path.join(__dirname, 'files');
		let file = path.join(dir, 'City - Plopsaland.sc4');
		let nybt = path.join(PLUGINS, 'NYBT');

		let c = 'c:/GOG Games/SimCity 4 Deluxe Edition';
		// let index = new FileIndex(nybt);
		let index = new FileIndex({
			files: [
				path.join(c, 'SimCity_1.dat'),
				path.join(c, 'SimCity_2.dat'),
				path.join(c, 'SimCity_3.dat'),
				path.join(c, 'SimCity_4.dat'),
				path.join(c, 'SimCity_5.dat'),
			]
		});
		await index.build();

		let city = new CityManager({ index });
		city.load(file);

		// Create the skyline in the city.
		skyline({ city });

		// Save the city.
		let out = path.join(REGION, 'City - Plopsaland.sc4');
		await city.save({ file: out });

	});

	it.skip('includes the textures when plopping', async function() {

		this.timeout(0);

		let dir = path.join(__dirname, 'files');
		let file = path.join(dir, 'City - Textures.sc4');
		let index = new FileIndex({
			files: [
				path.join(c, 'SimCity_1.dat'),
			],
			dirs: [
				path.join(PLUGINS, 'Two Simple 1 x 1 Residential Lots v2'),
			],
		});
		await index.build();

		let city = new CityManager({ index });
		city.load(file);
		// console.log(city.dbpf.textures[0]);

		for (let i = 0; i < 9; i++) {
			for (let j = 0; j < 9; j++) {
				if (i === 1 && j === 1) {
					continue;
				}
				city.grow({
					tgi: [0x6534284a,0xa8fbd372,0xa706ed25],
					x: i,
					z: j,
					// orientation: i,
				});
			}
		}

		// console.table(city.dbpf.textures, [
		// 	'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9',
		// ]);

		// console.table([
		// 	city.dbpf.textures[0].textures[0],
		// 	city.dbpf.textures[1].textures[0],
		// ]);

		// console.table([
		// 	city.dbpf.textures[0].textures[1],
		// 	city.dbpf.textures[1].textures[1],
		// ]);

		// Save
		let out = path.join(REGION, 'City - Textures.sc4');
		await city.save({ file: out });

	});

	it.only('includes the base texture when plopping', async function() {

		this.timeout(0);
		let dir = path.join(__dirname, 'files');
		let out = path.join(REGION, 'City - Base Textures.sc4');
		// let source = path.join(dir, 'City - Base Textures.sc4');
		let source = out;

		let index = new FileIndex({
			files: [
				path.join(c, 'SimCity_1.dat'),
			],
			dirs: [
				path.join(PLUGINS, 'Two Simple 1 x 1 Residential Lots v2'),
			],
		});
		await index.build();

		let float = x => {
			return new Float32Array([x])[0];
		};

		let city = new CityManager({ index });
		city.load(source);

		// for (let i = 0; i < 64; i++) {
		// 	for (let j = 0; j < 64; j++) {
		// 		if (i === 1 && j === 1) {
		// 			continue;
		// 		}
		// 		city.grow({
		// 			tgi: [0x6534284a,0xa8fbd372,0xa706ed25],
		// 			x: i,
		// 			z: j,
		// 			// orientation: (i+j) % 4,
		// 		});
		// 	}
		// }

		let { textures } = city.dbpf;
		console.log('Texture entries in the city:', textures.length);

		// await city.save({ file: out });

	});

});
