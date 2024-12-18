// # network-tunnel-occupant-test.ts
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { FileType, NetworkTunnelOccupant, Savegame } from 'sc4/core';
import { compareUint8Arrays } from 'uint8array-extras';

describe('The network tunnel occupant subfile', function() {

	it('is properly decoded & encoded', function() {

		let dbpf = new Savegame(resource('City - Tunnel.sc4'));
		let entry = dbpf.find({ type: FileType.NetworkTunnelOccupant })!;
		let tunnels = entry.read();
		for (let tunnel of tunnels) {
			let crc = tunnel.crc;
			let buff = Buffer.from(tunnel.toBuffer());
			expect(buff.readUInt32LE(4)).to.equal(crc);
		}

		// Serialize the entire file right away. Should result in exactly the 
		// same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer()!;
		expect(compareUint8Arrays(source, check)).to.equal(0);

	});

	it('serializes an empty occupant', function() {
		let tile = new NetworkTunnelOccupant();
		tile.toBuffer();
	});

});
