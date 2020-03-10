// # tract-developer-test.js
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const DBPF = require('../lib/dbpf.js');
const { FileType } = require('../lib/enums.js');

describe('The tract developer file', function() {

	it('should be parsed & serialized correctly', function() {

		let file = path.resolve(__dirname, 'files/city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.TractDeveloper);
		let tract = entry.read();

		let source = entry.decompress();
		let check = tract.toBuffer();
		expect(check.toString('hex')).to.equal(source.toString('hex'));

	});

});