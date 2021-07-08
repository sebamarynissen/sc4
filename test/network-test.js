// # network-test.js
'use strict';
const fs = require('fs');
const { expect } = require('chai');
const Network = require('../lib/network.js');
const { getCityPath, getTestFile } = require('../lib/util.js');
const Savegame = require('../lib/savegame.js');

describe('A network tile', function() {

	it('is parsed and serialized correctly', function() {

		let file = getTestFile('City - Large Developed.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { network } = dbpf;
		let raw = dbpf.find(network.type).decompress();
		let out = network.toBuffer();
		expect(Buffer.compare(raw, out)).to.equal(0);

	});

	it.only('plays with values', async function() {

		// let file = getCityPath('Network');
		// let file = getCityPath('Wayside', 'New Delphina');
		let file = getCityPath('New Delphina', 'New Delphina');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let index = dbpf.networkIndex;

	});

});
