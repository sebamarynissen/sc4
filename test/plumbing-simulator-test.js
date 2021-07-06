// # plumbing-simulator-test.js
'use strict';
const { expect } = require('chai');
const fs = require('fs');
const Savegame = require('../lib/savegame.js');
const { getTestFile } = require('../lib/util.js');

describe('The plumbing simulator file', function() {

	it('is parsed & serialized correctly', function() {

		let file = getTestFile('City - Large developed.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let sim = dbpf.plumbingSimulator;

		let out = sim.toBuffer();
		let crc = out.readUInt32LE(4);
		expect(crc).to.equal(sim.crc);

	});

});
