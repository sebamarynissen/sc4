// # ltext-test.ts
import { expect } from 'chai';
import { compareUint8Arrays } from 'uint8array-extras';
import DBPF from '../dbpf.js';
import { resource } from '#test/files.js';
import FileType from '../file-types.js';

describe('The LTEXT file type', function() {

	it('properly parses & serializes an LTEXT file', function() {

		let dbpf = new DBPF(resource('signage-submenu.dat'));
		let entry = dbpf.find(0x2026960b, 0x123007bb, 0x83e040bb)!;
		let ltext = entry.read();
		expect(ltext.value).to.equal('Signage');
		expect(ltext.encoding).to.equal(0x1000);
		let buffer = ltext.toBuffer();
		expect(compareUint8Arrays(buffer, entry.buffer!)).to.equal(0);

	});

	it('handles 8-bit LTEXTs', function() {

		let dbpf = new DBPF(resource('City - Large developed.sc4'));
		let entries = dbpf.findAll({ type: FileType.LTEXT });
		for (let entry of entries) {
			let buffer = entry.decompress();
			let ltext = entry.read();
			expect(ltext.encoding).to.equal(0x0000);
			expect(ltext.value).to.equal('Temp.png');
			expect(compareUint8Arrays(buffer, ltext.toBuffer())).to.equal(0);
		}

	});

});
