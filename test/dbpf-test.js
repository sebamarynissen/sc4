// # dbpf-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');

const { hex } = require('../lib/util');
const FileType = require('../lib/file-types');
const DBPF = require('../lib/dbpf');
const Exemplar = require('../lib/exemplar');

describe('A DBPF file', function() {

	it('should be parsed', function() {

		let file = path.resolve(__dirname, 'files/cement.sc4lot');
		let buff = fs.readFileSync(file);

		// Parse the dbpf.
		let dbpf = new DBPF(buff);

	});

	it('should be serialized to a buffer', function() {
		let file = path.resolve(__dirname, 'files/cement.sc4lot');
		let dbpf = new DBPF(fs.readFileSync(file));

		// Serialize the DBPF into a buffer and immediately parse again so 
		// that we can compare.
		let buff = dbpf.toBuffer();
		let my = new DBPF(buff);
		
		expect(my.created).to.eql(dbpf.created);
		expect(my.modified).to.eql(dbpf.modified);
		for (let entry of my.exemplars) {
			let exemplar = entry.read();
			let check = dbpf.index.get(entry.id).read();
			expect(exemplar).to.eql(check);
		}

		my.save(path.resolve(__dirname, 'files/saved.sc4lot'));

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

	it('should read textual exemplars', function() {

		let file = path.resolve(__dirname, 'files/quotes.sc4desc');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.exemplars[0];
		let exemplar = entry.read();

	});

});

describe('A lot subfile', function() {

	it.only('should compute the all crc checksums correctly', function() {

		let file = path.resolve(__dirname, 'files/city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		// Find the lot subfile & read it.
		let entry = dbpf.entries.find(x => x.type === FileType.LotFile);
		let lotFile = entry.read();
		let lots = lotFile.lots;

		for (let i = 0; i < lots.length; i++) {
			let lot = lots[i];
			let crc = lot.crc;
			let calc = lot.calculateCRC();
			expect(crc).to.equal(calc);
		}

	});

});