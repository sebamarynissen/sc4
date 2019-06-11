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

		let entries = dbpf.entries.filter(entry => entry.compressed);
		for (let entry of entries) {
			let exmp = new Exemplar(entry.get());
			console.log(exmp.toBuffer());
			// console.log(...exmp.props.map(x => {
			// 	x.name = hex(x.name);
			// 	return x;
			// }));
		}

	});

});

function hex(nr) {
	return '0x'+(Number(nr).toString(16).padStart(8, '0'));
}