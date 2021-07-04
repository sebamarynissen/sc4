// # pipes-test.js
'use strict';
const { expect } = require('chai');
const fs = require('fs');
const DBPF = require('sc4/lib/dbpf.js');
const { getCityPath } = require('../lib/util.js');

describe('The pipes subfile', function() {

	it('is parsed correctly & serialized correctly', function() {

		let buffer = fs.readFileSync(getCityPath('Pipes', 'Experiments'));
		let dbpf = new DBPF(buffer);

		let entry = dbpf.find(0x49c05b9f);
		let raw = entry.decompress();
		let pipes = entry.read();
		let out = pipes.toBuffer();
		expect(Buffer.compare(out, raw)).to.equal(0);

	});

});
