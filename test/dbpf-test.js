// # dbpf-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');

const DBPF = require('../lib/dbpf');
const Exemplar = require('../lib/exemplar');

describe('A DBPF file', function() {

	it.only('should be parsed', function() {

		let file = path.resolve(__dirname, 'files/cement.sc4lot');
		let buff = fs.readFileSync(file);

		// Parse the dbpf.
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(entry => entry.compressed);
		let exmp = new Exemplar(entry.get());
		console.log(...exmp.props);

	});

});