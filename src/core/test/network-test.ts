import { expect } from 'chai';
import { DBPF, FileType, Savegame } from 'sc4/core';
import { SmartBuffer } from 'smart-arraybuffer';
import { compareUint8Arrays } from 'uint8array-extras';
import { resource } from '#test/files.js';

describe('The network subfile', function() {

	it('should be parsed & serialized correctly', function() {

		let dbpf = new DBPF(resource('city.sc4'));

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

	it('parses the network bboxes', function() {

		let dbpf = new Savegame(resource('City - Under the bridge.sc4'));
		let { network } = dbpf;
		for (let tile of network) {
			if (tile.position.y !== 270) continue;
			let { bbox } = tile;
			expect(bbox.min.y).to.equal(270);
			expect(bbox.max.y).to.equal(270);
		}

	});

});
