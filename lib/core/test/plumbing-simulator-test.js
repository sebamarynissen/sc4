// # plumbing-simulator-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import { Savegame } from 'sc4/core';
import resource from '#test/get-test-file.js';

describe('The plumbing simulator file', function() {

	it('is parsed & serialized correctly', function() {

		let file = resource('City - Large developed.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let sim = dbpf.plumbingSimulator;

		let out = sim.toBuffer();
		let crc = out.readUInt32LE(4);
		expect(crc).to.equal(sim.crc);

	});

});
