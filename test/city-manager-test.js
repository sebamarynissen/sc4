// # city-manager-test.js
"use strict";
const { expect } = require('chai');
const path = require('path');
const { glob } = require('glob');
const FileIndex = require('../lib/file-index.js');
const CityManager = require('../lib/city-manager.js');

describe('A city manager', function() {

	it.skip('should open a city', async function() {

		let file = path.resolve(__dirname, 'files/City - RCI.sc4');
		let city = new CityManager(file);

		await city.loadPlugins();

		let exemplar = city.plugins.find(0x6534284a,0xa8fbd372,0xc000c356).read();
		let objs = exemplar.lotObjects;
		let building = objs.find(obj => obj.type === 0x0);
		let iid = building.values[12];

		let bd = city.plugins.records.find(x => x.type === 0x6534284a && x.instance === iid).read();
		console.log(bd);

	});

	context('#mem()', function() {

		it('returns an unused memory address', async function() {

			let file = path.resolve(__dirname, 'files/City - RCI.sc4');
			let city = new CityManager();
			city.load(file);

			expect(city.mem()).to.equal(1);
			city.memRefs.add(2);
			expect(city.mem()).to.equal(3);
			expect(city.mem()).to.equal(4);

		});

	});

	context('#grow()', function() {

		const regions = path.join(process.env.HOMEPATH, 'Documents/SimCity 4/Regions/Experiments');

		it.skip('grows a lot', async function() {

			this.slow(1000);

			let dir = path.join(process.env.HOMEPATH, 'Documents/SimCity 4/Plugins_empty');
			let index = new FileIndex(dir);
			await index.build();

			// Create the city manager.
			let game = path.join(__dirname, 'files/City - 432.sc4');
			let city = new CityManager({ index });
			city.load(game);

			// console.log(city.dbpf.textures[0]);

			// Grow a lot.
			city.grow({
				tgi: [0x6534284a, 0xa8fbd372, 0x8fcc0f62],
				x: 10,
				z: 10,
				orientation: 0,
			});

			let file = path.join(regions, 'City - Plopsaland.sc4');
			await city.save({ file });

		});

		it('grows a lot with props', async function() {

			this.slow(1000);

			const dir = 'c:/GOG Games/Simcity 4 Deluxe Edition';
			let index = new FileIndex({
				files: glob.globSync('SimCity_*.dat', {
					absolute: true,
					cwd: dir,
				}),
			});
			await index.build();

			// Create the city manager.
			let game = path.join(__dirname, 'files/City - 432.sc4');
			let city = new CityManager({ index });
			city.load(game);

			// Grow a lot.
			city.grow({
				tgi: [0x6534284a, 0xa8fbd372, 0x600040d0],
				x: 10,
				z: 10,
				orientation: 0,
			});

			let file = path.join(regions, 'City - Plopsaland.sc4');
			await city.save({ file });

		});

	});

	context('#plop()', function() {

		it('plops a ploppable lot', async function() {

			this.slow(1000);

			// First of all we need to build up a file index that the city 
			// manager can use.
			// let dir = path.join(__dirname, 'files/DarkNight_11KingStreetWest');
			// let dir = path.join(__dirname,'files/DiegoDL-432ParkAvenue-LM-DN');
			let dir = path.join(process.env.HOMEPATH, 'Documents/SimCity 4/Plugins');
			let index = new FileIndex(dir);
			await index.build();

			// Create the city manager.
			let game = path.join(__dirname, 'files/City - 432.sc4');
			let city = new CityManager({ index });
			city.load(game);

			// Plop it baby.
			for (let i = 0; i < 1; i++) {
				city.plop({
					tgi: [0x6534284a, 0xd60100c4, 0x483248bb],
					// tgi: [0x6534284a,0x76fbb03a,0x290dc058],
					x: (1+i)*8,
					z: 8,
					orientation: i % 4,
				});
			}
			let regions = path.join(process.env.HOMEPATH, 'Documents/SimCity 4/Regions/Experiments');
			let file = path.join(regions, 'City - Plopsaland.sc4');
			await city.save({ file });

		});

	});

});
