// # network-manager-test.ts
import { expect } from 'chai';
import { resource } from '#test/files.js';
import Savegame from '../savegame.js';
import { compareUint8Arrays } from 'uint8array-extras';
import FileType from '../file-types.js';

describe('The network manager', function() {

	it('parses from large developed city', function() {

		let dbpf = new Savegame(resource('City - Large developed.sc4'));
		let entry = dbpf.find({ type: FileType.NetworkManager })!;
		let mgr = entry.read();
		let set = new Set();
		for (let pointer of mgr.pointers) {
			set.add(pointer.type);
		}
		expect(set).to.include.members([
			0x49c1a034,
			0x8a4bd52b,
			0x49cc1bcd,
		]);
		let buffer = mgr.toBuffer();
		expect(compareUint8Arrays(entry.decompress(), buffer)).to.equal(0);

	});

});
