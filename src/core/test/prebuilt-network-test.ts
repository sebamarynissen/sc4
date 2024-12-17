// # prebuilt-network-test.ts
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { FileType, Savegame } from 'sc4/core';

describe('The prebuilt network file', function() {

	it('is properly decoded & serialized', function() {

		let dbpf = new Savegame(resource('City - Large developed.sc4'));
		let entry = dbpf.find({ type: FileType.PrebuiltNetwork })!;
		let network = entry.read();
		for (let tile of network) {
			let crc = tile.crc;
			let buff = Buffer.from(tile.toBuffer());
			expect(buff.readUInt32LE(4)).to.equal(crc);
		}

	});

});
