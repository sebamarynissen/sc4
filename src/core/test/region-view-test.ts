// # region-view-test.ts
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { FileType, Savegame } from 'sc4/core';
import { compareUint8Arrays } from 'uint8array-extras';

describe('The RegionView subfile', function() {

	it('parses a small, empty tile', function() {
		let dbpf = new Savegame(resource('City - Empty small tile.sc4'));
		let entry = dbpf.find({ type: FileType.RegionView })!;
		let view = entry.read();
		expect(view.population).to.eql({
			residential: 0,
			commercial: 0,
			industrial: 0,
		});
		expect(view.name).to.equal('Diego');
		expect(view.mayorName).to.equal('Sebastiaan Marynissen');
		expect(view.neighbourConnections).to.have.length(0);
	});

	it('parses a large developed tile', function() {
		let dbpf = new Savegame(resource('City - Large developed.sc4'));
		let entry = dbpf.find({ type: FileType.RegionView })!;
		let view = entry.read();
		expect(view.population).to.eql({
			residential: 34639,
			commercial: 5541,
			industrial: 0,
		});
		expect(view.mode).to.equal('mayor');
		expect(view.name).to.equal('North Sebastia');
		expect(view.mayorName).to.equal('Sebastiaan Marynissen');
		expect(view.neighbourConnections).to.have.length(19);

		let serialized = view.toBuffer();
		let buffer = entry.decompress().slice(0, serialized.byteLength);
		expect(compareUint8Arrays(serialized, buffer)).to.equal(0);

	});

});
