// # api-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const path = require('path');
const fs = require('fs');
const api = require('../lib/api.js');
const { Savegame } = api;
const { ZoneType } = require('../lib/enums');

const { historical, growify } = api;
const files = path.join(__dirname, 'files');

describe('#historical()', function() {

	it('should make all buildings in a city historical', async function() {

		let dbpf = await historical({
			dbpf: path.join(files, 'city.sc4'),
			all: true
		});
		
		// Check the dbpf file now. Everything should be historical.
		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.be.true;
		}

	});

	it('should make all residentials in a city historical', async function() {
		let dbpf = await historical({
			dbpf: path.join(files, 'city.sc4'),
			residential: true
		});

		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.equal(lot.isResidential);
		}

	});

	it('should make all commercials in a city historical', async function() {
		let dbpf = await historical({
			dbpf: path.join(files, 'city.sc4'),
			commercial: true
		});

		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.equal(lot.isCommercial);
		}

	});

	it('should make all industrials in a city historical', async function() {
		let dbpf = await historical({
			dbpf: path.join(files, 'city.sc4'),
			industrial: true
		});

		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.equal(lot.isIndustrial);
		}

	});

	it('should make all agriculturals in a city historical', async function() {
		let dbpf = await historical({
			dbpf: path.join(files, 'city.sc4'),
			agricultural: true
		});

		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.equal(lot.isAgricultural);
		}

	});

});

describe('#growify', function() {

	it('should growify all plopped residentials in a city', async function() {

		let buff = fs.readFileSync(path.join(files, 'City - RCI.sc4'));
		let dbpf = new Savegame(buff);
		let plopped = new Set();
		for (let lot of dbpf.lotFile) {
			if (lot.isPloppedResidential) plopped.add(lot);
		}
		expect(plopped.size).to.be.above(0);

		await growify({
			dbpf,
			residential: ZoneType.RMedium,
		});

		for (let lot of dbpf.lotFile) {
			if (plopped.has(lot)) {
				expect(lot.zoneType).to.equal(ZoneType.RMedium);
				expect(lot.isPlopped).to.be.false;
			}
		}

	});

	it('should growify all plopped industrials in a city', async function() {

		let buff = fs.readFileSync(path.join(files, 'City - labP01.sc4'));
		let dbpf = new Savegame(buff);
		let plopped = new Set();
		for (let lot of dbpf.lotFile) {
			if (lot.isPloppedIndustrial) plopped.add(lot);
		}
		expect(plopped.size).to.be.above(0);

		await growify({
			dbpf,
			industrial: ZoneType.IHigh
		});

		for (let lot of dbpf.lotFile) {
			if (plopped.has(lot)) {
				expect(lot.zoneType).to.equal(ZoneType.IHigh);
				expect(lot.isPlopped).to.be.false;
			}
		}

	});

	it('should growify all plopped agriculturals in a city', async function() {

		let buff = fs.readFileSync(path.join(files, 'City - RCI.sc4'));
		let dbpf = new Savegame(buff);
		let plopped = new Set();
		for (let lot of dbpf.lotFile) {
			if (lot.isPloppedAgricultural) plopped.add(lot);
		}
		expect(plopped.size).to.be.above(0);

		await growify({
			dbpf,
			agricultural: ZoneType.ILow,
		});

		for (let lot of dbpf.lotFile) {
			if (plopped.has(lot)) {
				expect(lot.zoneType).to.equal(ZoneType.ILow);
				expect(lot.isPlopped).to.be.false;
			}
		}

	});

});