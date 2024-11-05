// # tract-developer-test.js
const fs = require('node:fs');
const { expect } = require('chai');
const { DBPF, FileType } = require('sc4/core');
const resource = require('./get-test-file.js');

describe('The tract developer file', function() {

	it('should be parsed & serialized correctly', function() {

		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.TractDeveloper);
		let tract = entry.read();

		let source = entry.decompress();
		let check = tract.toBuffer();
		expect(check.toString('hex')).to.equal(source.toString('hex'));

	});

});
