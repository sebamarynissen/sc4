// # pipes-test.js
import { expect } from 'chai';
import { compareUint8Arrays } from 'uint8array-extras';
import fs from '#test/fs.js';
import { DBPF } from 'sc4/core';
import { resource } from '#test/files.js';

describe('The pipes subfile', function() {

	it('is parsed correctly & serialized correctly', function() {

		let file = resource('City - Pipes.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new DBPF(buffer);

		let entry = dbpf.find(0x49c05b9f);
		let raw = entry.decompress();
		entry.read();
		let out = entry.toBuffer();
		expect(compareUint8Arrays(out, raw)).to.equal(0);

	});

});
