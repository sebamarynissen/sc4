// # dbpf-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');

const DBPF = require('../lib/dbpf');
const Exemplar = require('../lib/exemplar');

describe('A DBPF file', function() {

	it('should be parsed', function() {

		let file = path.resolve(__dirname, 'files/cement.sc4lot');
		let buff = fs.readFileSync(file);

		// Parse the dbpf.
		let dbpf = new DBPF(buff);

	});

});

describe('An exemplar file', function() {

	it('should serialize to a buffer correctly', function() {

		// Read an exemplar from a sample dbpf first.
		let file = path.resolve(__dirname, 'files/cement.sc4lot');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let exemplars = dbpf.exemplars;
		let raw = exemplars.map(entry => entry.decompress());

		for (let i = 0; i < exemplars.length; i++) {
			let entry = exemplars[i];
			let exemplar = entry.read()
			let bin = exemplar.toBuffer().toString('hex');
			let check = raw[i].toString('hex');
			expect(bin).to.equal(check);
		}

	});

});