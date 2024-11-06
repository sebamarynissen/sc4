// # tract-developer-test.js
import fs from 'node:fs';
import { expect } from 'chai';
import { DBPF, FileType } from 'sc4/core';
import { resource } from '#test/files.js';

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
