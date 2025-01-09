import { resource } from '#test/files.js';
import { expect } from 'chai';
import FileType from '../file-types.js';
import Savegame from '../savegame.js';
import SimulatorDate from '../simulator-date.js';

// # csc4-city-test.ts
describe('#cSC4City', function() {

	it('parses a god mode tile', function() {

		let dbpf = new Savegame(resource('God mode.sc4'));
		let entry = dbpf.find({ type: FileType.cSC4City })!;
		let city = entry.read();
		expect(city.date).to.eql(SimulatorDate.fromYearMonthDay(2000, 1, 1));
		expect(city.name).to.equal('New City');
		expect(city.originalName).to.equal('');
		expect(city.anotherName).to.equal('');
		expect(city.size).to.eql([64, 64]);
		expect(city.physicalSize).to.eql([1024, 1024]);
		expect(city.physicalTileSize).to.eql([16, 16]);
		expect(city.tilesPerMeter).to.eql([1/16, 1/16]);

	});

	it('parses a medium tile', function() {
		let dbpf = new Savegame(resource('City - medium.sc4'));
		let entry = dbpf.find({ type: FileType.cSC4City })!;
		let city = entry.read();
		expect(city.date).to.eql(SimulatorDate.fromYearMonthDay(2000, 1, 11));
		expect(city.name).to.equal('Bridges');
		expect(city.mayor).to.equal('Sebastiaan Marynissen');
		expect(city.anotherName).to.equal('Bridges');
		expect(city.originalName).to.equal('New City');
		expect(city.size).to.eql([128, 128]);
		expect(city.physicalSize).to.eql([2048, 2048]);
		expect(city.physicalTileSize).to.eql([16, 16]);
		expect(city.tilesPerMeter).to.eql([1/16, 1/16]);
	});

	it('parses a large tile', function() {
		let dbpf = new Savegame(resource('City - large developed.sc4'));
		let entry = dbpf.find({ type: FileType.cSC4City })!;
		let city = entry.read();
		expect(city.date).to.eql(SimulatorDate.fromYearMonthDay(2052, 1, 17));
		expect(city.name).to.equal('North Sebastia');
		expect(city.mayor).to.equal('Sebastiaan Marynissen');
		expect(city.anotherName).to.equal('North Sebastia');
		expect(city.originalName).to.equal('New City');
		expect(city.size).to.eql([256, 256]);
		expect(city.physicalSize).to.eql([4096, 4096]);
		expect(city.physicalTileSize).to.eql([16, 16]);
		expect(city.tilesPerMeter).to.eql([1/16, 1/16]);
	});

});
