// # plop-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import curve from 'hilbert-curve';
import * as api from 'sc4/api';
import Stream from '../lib/core/stream.js';
import crc32 from '../lib/core/crc.js';
import { hex, chunk, split, getCityPath } from 'sc4/utils';
import { ZoneType, FileType, cClass } from 'sc4/core';
import CityManager from '../lib/api/city-manager.js';
import FileIndex from '../lib/api/file-index.js';
import LotIndex from '../lib/api/lot-index.js';
import skyline from '../lib/api/skyline.js';
import { Savegame, Lot, Building, Pointer } from 'sc4/core';
const HOME = process.env.HOMEPATH;
const PLUGINS = path.resolve(HOME, 'documents/SimCity 4/plugins');
const REGION = path.resolve(HOME, 'documents/SimCity 4/regions/experiments');
const c = 'c:/GOG Games/SimCity 4 Deluxe Edition';
const __dirname = import.meta.dirname;
const dir = path.join(__dirname, 'files');

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
				dev.cells[x][z] = new Pointer(lot);
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
		index[64][64].push(new Pointer(building));

		// Add the building to the lot developer.
		dev = dbpf.lotDeveloperFile;
		dev.buildings.push(new Pointer(building));

		// Now add the texture as well.
		let txs = dbpf.baseTextureFile;
		source = txs[0];

		// Don't forget that the textures array needs to be cloned as well!
		let tx = clone(source);
		tx.textures = tx.textures.map(clone);
		tx.mem += 4;
		tx.minX += 2*16;
		tx.maxX += 2*16;
		tx.textures.forEach(function(tx) {
			tx.x += 2;
		});
		// tx.textures[0].u7 = 1;
		txs.push(tx);

		// Add to the item index.
		index[64][64].push(new Pointer(tx));

		// Now update the com serializer as well.
		let com = dbpf.COMSerializerFile;
		com.set(FileType.LotFile, lots.length);
		com.set(FileType.BuildingFile, buildings.length);
		com.set(FileType.BaseTextureFile, txs.length);

		// Time for action: save!
		await dbpf.save({ file: path.resolve(REGION, 'City - Move bitch.sc4') });

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
			FileType.SimGridFloat32,
		];
		for (let type of all) {
			let grids = dbpf.getByType(type).read();
			for (let grid of grids) {
				for (let i = 0; i < grid.data.length; i++) {
					grid.data[i] = 0;
				}
			}
		}

		await dbpf.save({ file: path.resolve(REGION, 'City - Established.sc4') });

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
				itemIndexFile[xx][zz].push(new Pointer(clone));

			}
		}

		COMSerializerFile.set(FileType.FloraFile, floraFile.length);
		// console.log(COMSerializerFile.get(FileType.FloraFile));
		console.log(COMSerializerFile);

		await dbpf.save({ file: path.resolve(REGION, 'City - Flora.sc4') });

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
				let tree = clone(Math.floor(2*Math.random()));
				tree.x = 16*17 + 16*i + 8;
				tree.z = 16*10 + (j === 0 ? 2 : 14);
				floraFile.push(tree);
				let xx = 64 + Math.floor(tree.x / 64);
				let zz = 64 + Math.floor(tree.z / 64);
				tree.xMinTract = tree.xMaxTract = xx;
				tree.zMinTract = tree.zMaxTract = zz;
				itemIndexFile[xx][zz].push(new Pointer(tree));
			}
		}

		COMSerializerFile.set(FileType.FloraFile, floraFile.length);

		await dbpf.save({ file: path.resolve(REGION, 'City - Million Trees.sc4') });

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
		await dbpf.save({ file: path.join(REGION, 'City - Move bitch.sc4') });

	});

	it('builds a skyline', async function() {

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
			],
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

	it.skip('builds a skyline on a medium tile', async function() {

		this.timeout(0);

		let dir = path.join(__dirname, 'files');
		let file = path.join(dir, 'City - Medium tile.sc4');

		let c = 'c:/GOG Games/SimCity 4 Deluxe Edition';
		let index = new FileIndex({
			files: [
				path.join(c, 'SimCity_1.dat'),
				path.join(c, 'SimCity_2.dat'),
				path.join(c, 'SimCity_3.dat'),
				path.join(c, 'SimCity_4.dat'),
				path.join(c, 'SimCity_5.dat'),
			],
		});
		await index.build();

		let city = new CityManager({ index });
		city.load(file);

		// Create the skyline in the city.
		skyline({ city });

		// Save the city.
		let out = path.join(REGION, 'City - Medium tile.sc4');
		await city.save({ file: out });

	});

	it.skip('builds a skyline on a hilly terrain', async function() {

		this.timeout(0);

		let file = path.join(__dirname, 'files/City - Hilly skyline.sc4');
		let c = 'c:/GOG Games/SimCity 4 Deluxe Edition';
		let index = new FileIndex({
			files: [1, 2, 3, 4, 5].map(nr => path.join(c, `SimCity_${nr}.dat`)),
		});
		await index.build();

		let city = new CityManager({ index });
		city.load(file);

		skyline({ city });

		// Save the city.
		let out = path.join(REGION, 'City - Hilly skyline.sc4');
		await city.save({ file: out });

	});

	it.skip('creates a suburb', async function() {

		this.timeout(0);
		let file = 'c:/users/sebam/desktop/City - Suburb.sc4';
		let c = 'c:/GOG Games/SimCity 4 Deluxe Edition';
		let index = new FileIndex({
			files: [1].map(nr => path.join(c, `SimCity_${nr}.dat`)),
		});
		await index.build();
		let city = new CityManager({ index });
		city.load(file);

		let lots = new LotIndex(city.index)
			.height
			.query({ occupantGroups: [0x11020] })
			.filter(entry => {
				let { x, z } = entry.size;
				return x === 1 && z === 3;
			})
			.filter(entry => entry.growthStage < 4)
			.filter(entry => entry.occupantGroups.includes(0x2001));

		console.log(lots.length);

		function row(z = 0, orientation = 0) {
			for (let i = 0; i < 2*128; i++) {
				if (i % 13 === 7) continue;
				let index = Math.floor(lots.length * Math.random());
				let entry = lots[index];
				city.grow({
					lot: entry.lot,
					building: entry.building,
					x: i,
					z,
					orientation,
				});
			}
		}
		let dz = 7;
		for (let i = 2; i <= 2*128-dz; i += dz) {
			row(i, 0);
			row(i+3, 2);
		}

		await city.save({ file: getCityPath('Suburb', 'Suburb') });

	});

	it('creates a Mattb suburb', async function() {

		this.timeout(0);
		let file = 'c:/users/sebam/desktop/City - Mattb.sc4';
		let c = 'c:/GOG Games/SimCity 4 Deluxe Edition';
		let index = new FileIndex({
			files: [1, 2, 3, 4, 5].map(nr => path.join(c, `SimCity_${nr}.dat`)),
		});
		await index.build();
		let city = new CityManager({ index });
		city.load(file);

		let set = new Set();
		let lots = new LotIndex(city.index).height
			.filter(lot => {
				let building = lot.buildingExemplar;
				let name = building.table['Exemplar Name'].value;
				if (!/^R\$\$[^$]/.test(name)) return false;
				if (name === 'R$$12x14_123HouStdHouse9_00D1') {
					// console.log(building);
					console.log(lot.lot.read().table['Exemplar Name'].value);
				}
				set.add(name);
				return true;
			});

		console.log(set);
		console.log(set.size);

		// let lots = new LotIndex(city.index)
		// 	.height
		// 	.query({
		// 		// occupantGroups: [0x11020],
		// 	})
		// 	// .filter(entry => entry.occupantGroups.includes(0x2000))
		// 	// .filter(entry => entry.zoneTypes.includes(0x01))
		// 	.filter(entry => {
		// 		return true;
		// 		let [x, z] = entry.size;
		// 		return x === 1 && z === 3;
		// 	})
		// 	.filter(entry => entry.growthStage < 4)
		// 	.filter(entry => {
		// 		let name = entry.buildingExemplar.table['Exemplar Name'].value;
		// 		return /(Chi)|(NY)/.test(name);
		// 	});
		return;

		function row(z = 0, orientation = 0) {
			for (let i = 0; i < 128; i++) {
				if (i % 13 === 7) continue;
				if (Math.random() < 0.01) continue;
				let index = Math.floor(lots.length * Math.random());
				let { lot } = lots[index];
				city.grow({
					exemplar: lot,
					x: i,
					z,
					orientation,
				});
			}
		}
		let dz = 7;
		for (let i = 2; i <= 128-dz; i += dz) {
			row(i, 0);
			row(i+3, 2);
		}

		await city.save({ file: getCityPath('Suburb') });

	});

	it.skip('creates RCI zones', async function() {

		this.timeout(0);

		let source = path.join(dir, 'City - Zone me.sc4');
		let out = path.join(REGION, 'City - Zone me.sc4');
		let city = new CityManager({});
		city.load(source);

		// Create a new zone.
		city.zone({
			x: 1,
			z: 0,
			orientation: 2,
		});

		// console.log(city.dbpf.textures);
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
					tgi: [0x6534284a, 0xa8fbd372, 0xa706ed25],
					x: i,
					z: j,
					orientation: (i+j) % 4,
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

	it.skip('includes the base texture when plopping', async function() {

		this.timeout(0);
		let dir = path.join(__dirname, 'files');
		let out = path.join(REGION, 'City - Base Textures.sc4');
		let source = path.join(dir, 'City - Base Textures.sc4');
		// let source = out;

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
		city.load(source);

		for (let i = 0; i < 5; i++) {
			for (let j = 0; j < 5; j++) {
				if (i === 1 && j === 1) {
					continue;
				}
				city.grow({
					tgi: [0x6534284a, 0xa8fbd372, 0xa706ed25],
					x: i,
					z: j,
					orientation: (i+j) % 4,
				});
				// break;
			}
			// break;
		}

		await city.save({ file: out });

	});

	it.skip('plops a Hilbert curve', async function() {

		this.timeout();
		let dir = path.join(__dirname, 'files');
		let source = path.join(dir, 'City - Large Tile.sc4');
		let out = path.join(REGION, 'City - Large Tile.sc4');

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
		city.load(source);
		let zones = city.dbpf.zones;

		const order = 6;
		const n = 2**order;
		const nn = n**2;
		let data = [];
		const length = 5;
		for (let i = 0; i < nn; i++) {
			let point = curve.indexToPoint(i, order);
			data.push({
				x: (length-1)*point.x,
				z: (length-1)*point.y,
			});
		}

		let matrix = Array(length*n).fill().map(() => {
			return Array(length*n).fill();
		});

		for (let i = 1; i < data.length; i++) {
			let P = data[i-1];
			let Q = data[i];
			let d = {
				x: (Q.x - P.x)/(length-1),
				z: (Q.z - P.z)/(length-1),
			};
			for (let j = 0; j < length; j++) {
				let xx = P.x + d.x*j + 2;
				let zz = P.z + d.z*j + 2;
				matrix[xx][zz] = true;
			}
		}

		// Loop the entire curve and grow a lot to the left or to the right.
		for (let i = 1; i < data.length; i++) {
			let P = data[i-1];
			let Q = data[i];
			let d = {
				x: (Q.x - P.x)/(length-1),
				z: (Q.z - P.z)/(length-1),
			};
			let n = {
				x: d.z,
				z: -d.x,
			};
			for (let j = 0; j < length; j++) {
				let xx = P.x + d.x*j + 2;
				let zz = P.z + d.z*j + 2;
				for (let s of [-1, 1]) {
					let x = xx + n.x*s;
					let z = zz + n.z*s;
					if (zones.cells[x][z]) continue;
					if (x < 0 || z < 0) continue;
					if (matrix[x][z]) continue;

					city.grow({
						tgi: [0x6534284a, 0xa8fbd372, 0xa706ed25],
						x,
						z,
					});

				}
			}
		}

		// Save baby.
		await city.dbpf.save({ file: out });

	});

});
