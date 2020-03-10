// # city-manager-test.js
"use strict";
const { expect } = require('chai');
const CityManager = require('../lib/city-manager');
const path = require('path');

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
			let city = new CityManager(file);

			expect(city.mem()).to.equal(1);
			city.memRefs.add(2);
			expect(city.mem()).to.equal(3);
			expect(city.mem()).to.equal(4);

		});

	});

});