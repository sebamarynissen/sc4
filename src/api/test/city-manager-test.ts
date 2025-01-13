// # city-manager-test.ts
import { Savegame, FileType, Exemplar, TGI, Vector3, SimulatorDate } from 'sc4/core';
import CityManager from '../city-manager.js';
import { expect } from 'chai';

describe('The CityManager class', function() {

	describe('#createProp()', function() {

		it('creates a non-conditional prop', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('OccupantSize', [4, 1, 5]);
			let dbpf = new Savegame();
			let mgr = new CityManager({ dbpf });
			let tgi = TGI.random(FileType.Exemplar);

			let prop = mgr.createProp({
				position: new Vector3(5, 0, 5),
				exemplar,
				tgi,
				OID: 4,
			});
			expect(prop.bbox[0]).to.eql([3, 270, 2.5]);
			expect(prop.bbox[1]).to.eql([7, 271, 7.5]);
			expect(prop.condition).to.equal(0);
			expect(prop.timing).to.be.null;
			expect(prop.OID).to.equal(4);
			expect(prop.start).to.equal(0);
			expect(prop.stop).to.equal(0);
			expect(dbpf.COMSerializer.get(FileType.Prop)).to.equal(1);

		});

		it('creates an active date timed prop', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('OccupantSize', [4, 4, 4]);
			exemplar.addProperty('SimulatorDateStart', [3, 1]);
			exemplar.addProperty('SimulatorDateDuration', 91);
			exemplar.addProperty('SimulatorDateInterval', 365);
			let dbpf = Savegame.create({ size: 'small' });
			dbpf.buffer = dbpf.toBuffer();
			let { date } = dbpf;
			date.date = date.date.with({ year: 2001, month: 3, day: 28 });
			let mgr = new CityManager({ dbpf });
			let tgi = TGI.random(FileType.Exemplar);

			let prop = mgr.createProp({
				position: new Vector3(2, 0, 2),
				exemplar,
				tgi,
			});
			expect(prop.timing).to.be.ok;
			expect(prop.timing?.start).to.eql(SimulatorDate.fromYearMonthDay(2002, 3, 1));
			expect(prop.timing?.end).to.eql(SimulatorDate.fromYearMonthDay(2001, 5, 31));
			expect(prop.timing?.duration).to.equal(91);
			expect(prop.timing?.interval).to.equal(365);
			expect(prop.state).to.equal(0);
			expect(prop.condition).to.equal(0x0f);
			expect(dbpf.propDeveloper.dateTimedProps).to.have.length(1);
			expect(dbpf.propDeveloper.dateTimedProps[0].address).to.equal(prop.mem);
			expect(dbpf.COMSerializer.get(FileType.Prop)).to.equal(1);

		});

		it('creates a date timed prop that will become active', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('OccupantSize', [4, 4, 4]);
			exemplar.addProperty('SimulatorDateStart', [12, 1]);
			exemplar.addProperty('SimulatorDateDuration', 32);
			exemplar.addProperty('SimulatorDateInterval', 365);
			let dbpf = Savegame.create({ size: 'small' });
			dbpf.buffer = dbpf.toBuffer();
			let { date } = dbpf;
			date.date = date.date.with({ year: 2025, month: 11, day: 20 });
			let mgr = new CityManager({ dbpf });
			let tgi = TGI.random(FileType.Exemplar);

			let prop = mgr.createProp({
				position: new Vector3(2, 0, 2),
				exemplar,
				tgi,
			});
			expect(prop.timing).to.be.ok;
			expect(prop.timing?.start).to.eql(SimulatorDate.fromYearMonthDay(2025, 12, 1));
			expect(prop.timing?.end).to.eql(SimulatorDate.fromYearMonthDay(2026, 1, 2));
			expect(prop.timing?.duration).to.equal(32);
			expect(prop.timing?.interval).to.equal(365);
			expect(prop.state).to.equal(1);
			expect(prop.condition).to.equal(0x0d);
			expect(dbpf.propDeveloper.dateTimedProps).to.have.length(1);
			expect(dbpf.propDeveloper.dateTimedProps[0].address).to.equal(prop.mem);

		});

		it('creates a date timed prop that has been active already this year', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('OccupantSize', [4, 4, 4]);
			exemplar.addProperty('SimulatorDateStart', [3, 1]);
			exemplar.addProperty('SimulatorDateDuration', 91);
			exemplar.addProperty('SimulatorDateInterval', 365);
			let dbpf = Savegame.create({ size: 'small' });
			dbpf.buffer = dbpf.toBuffer();
			let { date } = dbpf;
			date.date = date.date.with({ year: 2025, month: 11, day: 20 });
			let mgr = new CityManager({ dbpf });
			let tgi = TGI.random(FileType.Exemplar);

			let prop = mgr.createProp({
				position: new Vector3(2, 0, 2),
				exemplar,
				tgi,
			});
			expect(prop.timing).to.be.ok;
			expect(prop.timing?.start).to.eql(SimulatorDate.fromYearMonthDay(2026, 3, 1));
			expect(prop.timing?.end).to.eql(SimulatorDate.fromYearMonthDay(2026, 5, 31));
			expect(prop.timing?.duration).to.equal(91);
			expect(prop.timing?.interval).to.equal(365);
			expect(prop.state).to.equal(1);
			expect(prop.condition).to.equal(0x0d);
			expect(dbpf.propDeveloper.dateTimedProps).to.have.length(1);
			expect(dbpf.propDeveloper.dateTimedProps[0].address).to.equal(prop.mem);

		});

		it('creates an active hour timed prop', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('OccupantSize', [4, 4, 4]);
			exemplar.addProperty('PropTimeOfDay', [12, 15]);
			let dbpf = Savegame.create({ size: 'medium' });
			dbpf.buffer = dbpf.toBuffer();
			let { clock } = dbpf;
			clock.secondOfDay = 13*3600;

			let mgr = new CityManager({ dbpf });
			let tgi = TGI.random(FileType.Exemplar);

			let prop = mgr.createProp({
				position: new Vector3(2, 0, 2),
				exemplar,
				tgi,
			});
			expect(prop.timing).to.be.null;
			expect(prop.start).to.equal(120);
			expect(prop.stop).to.equal(150);
			expect(prop.state).to.equal(0);
			expect(prop.condition).to.equal(0x0f);
			expect(prop.lotType).to.equal(0x01);
			expect(dbpf.propDeveloper.hourTimedProps).to.have.length(1);
			expect(dbpf.propDeveloper.hourTimedProps[0].address).to.equal(prop.mem);

		});

		it('creates an non-active hour timed prop', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('OccupantSize', [4, 4, 4]);
			exemplar.addProperty('PropTimeOfDay', [15, 12]);
			let dbpf = Savegame.create({ size: 'medium' });
			dbpf.buffer = dbpf.toBuffer();
			let { clock } = dbpf;
			clock.secondOfDay = 13*3600;

			let mgr = new CityManager({ dbpf });
			let tgi = TGI.random(FileType.Exemplar);

			let prop = mgr.createProp({
				position: new Vector3(2, 0, 2),
				exemplar,
				tgi,
				lotType: 0x02,
			});
			expect(prop.timing).to.be.null;
			expect(prop.start).to.equal(150);
			expect(prop.stop).to.equal(120);
			expect(prop.state).to.equal(1);
			expect(prop.condition).to.equal(0x0e);
			expect(prop.lotType).to.equal(0x02);
			expect(dbpf.propDeveloper.hourTimedProps).to.have.length(1);
			expect(dbpf.propDeveloper.hourTimedProps[0].address).to.equal(prop.mem);

		});

		it('creates an active night timed prop', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('OccupantSize', [1, 1, 1]);
			exemplar.addProperty('NighttimeStateChange', 1);
			let dbpf = Savegame.create({ size: 'large' });
			dbpf.buffer = dbpf.toBuffer();

			let mgr = new CityManager({ dbpf });
			let tgi = TGI.random(FileType.Exemplar);
			let { clock } = dbpf;
			clock.secondOfDay = 23*3600;

			let prop = mgr.createProp({
				position: new Vector3(0, 0, 0),
				exemplar,
				tgi,
			});
			expect(prop.state).to.equal(1);
			expect(prop.condition).to.equal(0);
			expect(dbpf.propDeveloper.nightTimedProps).to.have.length(1);
			expect(dbpf.propDeveloper.nightTimedProps[0].address).to.be.above(0);
			expect(dbpf.propDeveloper.nightTimedProps[0].address).to.equal(prop.mem);

		});

		it('creates an deactivated night timed prop', function() {

			let exemplar = new Exemplar();
			exemplar.addProperty('OccupantSize', [1, 1, 1]);
			exemplar.addProperty('NighttimeStateChange', 1);
			let dbpf = Savegame.create({ size: 'large' });
			dbpf.buffer = dbpf.toBuffer();

			let mgr = new CityManager({ dbpf });
			let tgi = TGI.random(FileType.Exemplar);
			let { clock } = dbpf;
			clock.secondOfDay = 11*3600;

			let prop = mgr.createProp({
				position: new Vector3(0, 0, 0),
				exemplar,
				tgi,
			});
			expect(prop.state).to.equal(0);
			expect(prop.condition).to.equal(0);
			expect(dbpf.propDeveloper.nightTimedProps).to.have.length(1);
			expect(dbpf.propDeveloper.nightTimedProps[0].address).to.be.above(0);
			expect(dbpf.propDeveloper.nightTimedProps[0].address).to.equal(prop.mem);

		});

	});

});
