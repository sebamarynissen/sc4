// # network-test.js
'use strict';
const fs = require('node:fs');
const { expect } = require('chai');
const { getTestFile } = require('../lib/util.js');
const { FileType } = require('../lib/enums.js');
const Savegame = require('../lib/savegame.js');

describe('The network index', function() {

	it('is parsed and serialized correctly', function() {

		let file = getTestFile('City - Large Developed.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { networkIndex } = dbpf;
		let raw = dbpf.find(FileType.NetworkIndex).decompress();
		let out = networkIndex.toBuffer();
		expect(Buffer.compare(out, raw)).to.equal(0);

	});

});
