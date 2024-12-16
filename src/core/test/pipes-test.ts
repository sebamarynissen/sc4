// # pipes-test.js
import { expect } from 'chai';
import { compareUint8Arrays } from 'uint8array-extras';
import fs from '#test/fs.js';
import { DBPF, Pipe, Savegame } from 'sc4/core';
import { resource } from '#test/files.js';

describe('The pipes subfile', function() {

	it('is parsed correctly & serialized correctly', function() {

		let file = resource('City - Pipes.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new DBPF(buffer);

		let entry = dbpf.find({ type: 0x49c05b9f })!;
		let raw = entry.decompress();
		entry.read();
		let out = entry.toBuffer();
		expect(compareUint8Arrays(out, raw)).to.equal(0);

	});

	it('serializes an empty pipe to a buffer', function() {

		let pipe = new Pipe();
		let buffer = pipe.toBuffer();
		expect(buffer).to.be.ok;

	});

	it('properly parses the range as a bbox', function() {

		let { pipes } = new Savegame(resource('City - Pipes.sc4'));
		for (let pipe of pipes) {
			let { min, max } = pipe.bbox;
			for (let i = 0; i < min.length; i++) {
				expect(min[i]).to.be.at.most(max[i]);
			}
		}

	});

});
