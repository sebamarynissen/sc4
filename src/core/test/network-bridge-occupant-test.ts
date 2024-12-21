// # network-bridge.ts
import { expect } from 'chai';
import { compareUint8Arrays } from 'uint8array-extras';
import { resource } from '#test/files.js';
import { Savegame, FileType } from 'sc4/core';
import { SmartBuffer } from 'smart-arraybuffer';

describe('The network bridge occupant', function() {

	it('is parsed and serialized correctly', function() {

		let dbpf = new Savegame(resource('City - Under the bridge.sc4'));

		let entry = dbpf.find({ type: FileType.Network })!;
		let network = entry.read();

		// Check the crc checksums. When we didn't modify a network tile, they 
		// should still match.
		for (let tile of network) {
			let crc = tile.crc;
			let buff = SmartBuffer.fromBuffer(tile.toBuffer());
			expect(buff.readUInt32LE(4)).to.equal(crc);
		}

		// Serialize the entire file right away. Should result in exactly the 
		// same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer()!;
		expect(compareUint8Arrays(source, check)).to.equal(0);

	});

});
