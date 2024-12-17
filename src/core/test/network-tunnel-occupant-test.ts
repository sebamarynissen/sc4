// # network-tunnel-occupant-test.ts
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { FileType, Savegame } from 'sc4/core';

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

	});

});
