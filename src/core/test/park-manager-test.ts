// # park-manager-test.ts
import { resource } from '#test/files.js';
import { expect } from 'chai';
import FileType from '../file-types.js';
import Savegame from '../savegame.js';

describe('The ParkManager', function() {

	it('parses a large developed tile', function() {
		let dbpf = new Savegame(resource('City - large developed.sc4'));
		let entry = dbpf.find({ type: FileType.ParkManager })!;
		let mgr = entry.read();
		expect(mgr.buildings).to.have.length(3564);
	});

});
