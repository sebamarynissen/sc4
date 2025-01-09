// # csc4-simulator-test.ts
import { resource } from '#test/files.js';
import { expect } from 'chai';
import Savegame from '../savegame.js';
import SimulatorDate from '../simulator-date.js';

describe('#cSC4Simulator', function() {

	it('properly parses the date subfile', function() {
		let dbpf = new Savegame(resource('City - Large Developed.sc4'));
		let { date } = dbpf;
		expect(date.hoursPerDay).to.equal(24);
		expect(date.dayOfYear).to.equal(26);
		expect(date.weekOfYear).to.equal(4);
		expect(date.monthOfYear).to.equal(1);
		expect(date.year).to.equal(2052);
		expect(date.date).to.eql(SimulatorDate.fromYearDateMonth(2052, 1, 26));
	});

});
