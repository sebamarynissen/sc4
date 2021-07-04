// # pipes-test.js
'use strict';
const fs = require('fs');
const DBPF = require('sc4/lib/dbpf.js');
const { getCityPath } = require('../lib/util.js');

describe('The pipes subfile', function() {

	it('is parsed correctly', function() {

		let buffer = fs.readFileSync(getCityPath('Pipes', 'Experiments'));
		let dbpf = new DBPF(buffer);

		let entry = dbpf.find(0x49c05b9f);
		let pipes = entry.read();
		console.log(pipes);

	});

});
