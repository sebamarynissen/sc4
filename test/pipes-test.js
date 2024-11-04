// # pipes-test.js
'use strict';
const { expect } = require('chai');
const fs = require('node:fs');
const { DBPF } = require('sc4');
const { getTestFile } = require('../lib/util.js');

describe('The pipes subfile', function() {

	it('is parsed correctly & serialized correctly', function() {

		let file = getTestFile('City - Pipes.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new DBPF(buffer);

		let entry = dbpf.find(0x49c05b9f);
		let raw = entry.decompress();
		entry.read();
		let out = entry.toBuffer();
		expect(Buffer.compare(out, raw)).to.equal(0);

	});

});
