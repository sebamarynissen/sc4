// # api-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import * as api from '../api.js';
import resource from '#test/get-test-file.js';
import { Savegame, ZoneType } from 'sc4/core';
const { historical, growify } = api;

describe('#historical()', function() {

	it('should make all buildings in a city historical', async function() {

		let dbpf = await historical({
			dbpf: resource('city.sc4'),
			all: true,
		});
		
		// Check the dbpf file now. Everything should be historical.
		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.be.true;
		}

	});

	it('should make all residentials in a city historical', async function() {
		let dbpf = await historical({
			dbpf: resource('city.sc4'),
			residential: true,
		});

		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.equal(lot.isResidential);
		}

	});

	it('should make all commercials in a city historical', async function() {
		let dbpf = await historical({
			dbpf: resource('city.sc4'),
			commercial: true,
		});

		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.equal(lot.isCommercial);
		}

	});

	it('should make all industrials in a city historical', async function() {
		let dbpf = await historical({
			dbpf: resource('city.sc4'),
			industrial: true,
		});

		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.equal(lot.isIndustrial);
		}

	});

	it('should make all agriculturals in a city historical', async function() {
		let dbpf = await historical({
			dbpf: resource('city.sc4'),
			agricultural: true,
		});

		for (let lot of dbpf.lotFile) {
			expect(lot.historical).to.equal(lot.isAgricultural);
		}

	});

});

describe('#growify', function() {

	it('should growify all plopped residentials in a city', async function() {

		let buff = fs.readFileSync(resource('City - RCI.sc4'));
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

		let buff = fs.readFileSync(resource('City - labP01.sc4'));
		let dbpf = new Savegame(buff);
		let plopped = new Set();
		for (let lot of dbpf.lotFile) {
			if (lot.isPloppedIndustrial) plopped.add(lot);
		}
		expect(plopped.size).to.be.above(0);

		await growify({
			dbpf,
			industrial: ZoneType.IHigh,
		});

		for (let lot of dbpf.lotFile) {
			if (plopped.has(lot)) {
				expect(lot.zoneType).to.equal(ZoneType.IHigh);
				expect(lot.isPlopped).to.be.false;
			}
		}

	});

	it('should growify all plopped agriculturals in a city', async function() {

		let buff = fs.readFileSync(resource('City - RCI.sc4'));
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
