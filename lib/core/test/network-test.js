// # network-test.js
'use strict';
const fs = require('node:fs');
const { expect } = require('chai');
const resource = require('#test/get-test-file.js');
const { Savegame, FileType } = require('sc4/core');

describe('The network index', function() {

	it('is parsed and serialized correctly', function() {

		let file = resource('City - Large Developed.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { networkIndex } = dbpf;
		let raw = dbpf.find(FileType.NetworkIndex).decompress();
		let out = networkIndex.toBuffer();
		expect(Buffer.compare(out, raw)).to.equal(0);

	});

});
