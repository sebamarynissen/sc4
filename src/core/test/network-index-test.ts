// # network-test.ts
import fs from '#test/fs.js';
import { expect } from 'chai';
import { compareUint8Arrays } from 'uint8array-extras';
import { resource } from '#test/files.js';
import { Savegame, FileType } from 'sc4/core';

describe('The network index', function() {

	it('is parsed and serialized correctly', function() {

		let file = resource('City - Large Developed.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { networkIndex } = dbpf;
		let raw = dbpf.find({ type: FileType.NetworkIndex })!.decompress();
		let out = networkIndex.toBuffer();
		expect(compareUint8Arrays(out, raw)).to.equal(0);

	});

});
