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
		expect(mgr.buildings2).to.have.length(0);
	});

	it('parses a medium developed tile', function() {
		let dbpf = new Savegame(resource('City - Wayside.sc4'));
		let entry = dbpf.find({ type: FileType.ParkManager })!;
		let mgr = entry.read();
		expect(mgr.buildings).to.have.length(78);
		expect(mgr.buildings2).to.have.length(1);
	});

});
