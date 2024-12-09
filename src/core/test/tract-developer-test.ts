// # tract-developer-test.js
import fs from '#test/fs.js';
import { expect } from 'chai';
import { DBPF, FileType } from 'sc4/core';
import { resource } from '#test/files.js';
import { compareUint8Arrays } from 'uint8array-extras';

describe('The tract developer file', function() {

	it('should be parsed & serialized correctly', function() {

		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.find({ type: FileType.TractDeveloper })!;
		let tract = entry.read();

		let source = entry.decompress();
		let check = tract.toBuffer();
		expect(compareUint8Arrays(check, source)).to.equal(0);

	});

});
