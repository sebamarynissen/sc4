// # city-manager-test.js
"use strict";
const { expect } = require('chai');
const path = require('path');
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

	context('#plop()', function() {

		it.only('plops a ploppable lot', async function() {

			this.slow(1000);

			// First of all we need to build up a file index that the city 
			// manager can use.
			// let dir = path.join(__dirname, 'files/DarkNight_11KingStreetWest');
			let dir = path.join(__dirname,'files/DiegoDL-432ParkAvenue-LM-DN');
			let index = new FileIndex(dir);
			await index.build();

			// Create the city manager.
			let game = path.join(__dirname, 'files/City - Plopsaland.sc4');
			let city = new CityManager({ index });
			city.load(game);

			// Plop it baby.
			city.plop({
				tgi: [0x6534284a, 0xd60100c4, 0x483248bb],
				x: 5,
				z: 5,
			});

		});

	});

});
