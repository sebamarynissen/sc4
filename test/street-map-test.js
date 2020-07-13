// # street-map-test.js
'use strict';
const { expect } = require('chai');
const StreetMap = require('../lib/street-map.js');

describe('A street map', function() {

	context('#constructor()', function() {

		it('sets up a 64x64 street map', function() {

			let map = new StreetMap(64);
			expect(map).to.have.length(64);
			for (let col of map) {
				expect(col).to.have.length(64);
			}

		});

		it('sets up a 256x256 street map', function() {

			let map = new StreetMap(256);
			expect(map).to.have.length(256);
			for (let col of map) {
				expect(col).to.have.length(256);
			}

		});

	});

	context('#draw()', function() {

		it('draws a horizontal line', function() {

			let map = new StreetMap(64);
			let type = 1;
			map.draw([0, 32], [63, 32], type);
			for (let i = 0; i < map.length; i++) {
				expect(map[i][32]).to.equal(type);
			}

		});

		it('draws a vertical line', function() {

			let map = new StreetMap(128);
			let type = 2;
			map.draw([64, 0], [64, 127], type);
			for (let i = 0; i < map.length; i++) {
				expect(map[64][i]).to.equal(type);
			}

		});

	});

});
