// # ltext-test.js
import { expect } from 'chai';
import { Buffer } from 'node:buffer';
import DBPF from '../dbpf.js';
import { resource } from '#test/files.js';

describe('The LTEXT file type', function() {

	it('properly parses & serializes an LTEXT file', function() {

		let dbpf = new DBPF(resource('signage-submenu.dat'));
		let entry = dbpf.find(0x2026960b, 0x123007bb, 0x83e040bb);
		let ltext = entry.read();
		let buffer = ltext.toBuffer();
		expect(Buffer.compare(buffer, entry.buffer)).to.equal(0);

	});

});