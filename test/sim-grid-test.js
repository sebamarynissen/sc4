// # sim-grid-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const REGION = require('./test-region');
const Stream = require('../lib/stream');
const Savegame = require('../lib/savegame');
const SimGridFile = require('../lib/sim-grid-file');
const { FileType } = require('../lib/enums');
const { split, chunk, hex } = require('../lib/util');

describe('A SimGridFile', function() {

	it('should parse & serialize correctly', function() {

		let source = path.resolve(__dirname, 'files/city - grid.sc4');
		if (!fs.existsSync(source)) {
			this.skip();
			return;
		}
		let dbpf = new Savegame(fs.readFileSync(source));

		// Test for all types.
		let all = [
			FileType.SimGridUint8,
			FileType.SimGridSint8,
			FileType.SimGridUint16,
			FileType.SimGridSint16,
			FileType.SimGridUint32,
			FileType.SimGridFloat32,
		];

		for (let type of all) {

			let entry = dbpf.getByType(type);
			let grids = entry.read();

			// Check that we can find the power grid.
			if (type === FileType.SimGridUint8) {
				const POWER = 0x49d5bc86;
				let power = grids.get(POWER);
				expect(power.dataId).to.equal(POWER);
			}

			// Serialize each grid independently.
			for (let grid of grids) {
				let crc = grid.crc;
				let buff = grid.toBuffer();
				expect(buff.readUInt32LE(4)).to.equal(crc);
			}

			// Check the entire grid.
			let check = entry.decompress();
			let buff = grids.toBuffer();
			expect(check.toString('hex')).to.equal(buff.toString('hex'));

		}

	});

});

describe('A single sim grid object', function() {

	it.skip('should output to pdf', function() {

		// Skip if we are not in a browser environment (i.e. electron).
		if (typeof document === 'undefined') {
			this.test.title += ' (Skipping due to no document available)';
			return this.skip();
		}

		// let source = path.resolve(REGION, 'City - grid.sc4');
		// let source = path.resolve(__dirname, 'files/city - grid.sc4');
		// let source = path.resolve(__dirname, 'files/city - Established.sc4');
		// let source = path.resolve(__dirname, 'files/city - Medium.sc4');
		// let source = path.resolve('c:/users/sebastiaan/documents/simcity 4/regions/Sebastia/City - North Sebastia.sc4');
		let source = path.resolve('C:\\Users\\Sebastiaan\\Documents\\SimCity 4 Modding\\Saved\\Old Regions\\Regions 2009\\New York\\City - New Sebastia.sc4');
		let dbpf = new Savegame(fs.readFileSync(source));

		let types = {
			"UInt8": 0x49b9e602,
			"SInt8": 0x49b9e603,
			"UInt16": 0x49b9e604,
			"Int16": 0x49b9e605,
			"UInt32": 0x49b9e606,
			"Float32": 0x49b9e60a
		};

		// document.querySelector('#view').remove();
		// document.querySelector('#mocha').remove();

		for (let type in types) {

			let num = types[type];

			let entry = dbpf.getByType(num);
			let buffers = split(entry.decompress());
			let h = document.createElement('h3');
			h.style.setProperty('font-family', 'Arial');
			h.textContent = `${type} (${hex(num)})`;
			document.body.append(h);
			let table = document.createElement('table');
			document.body.append(table);

			let format = '4 4 4 2 1 4 4 4 4 4 4 4 4 4'.split(' ').map(x => 2*x);

			// Pick the first one.
			for (let i = 0; i < buffers.length; i++) {
				let buffer = buffers[i];
				let grid = new SimGridFile.SimGrid();

				let td;
				let tr = document.createElement('tr');
				td = document.createElement('td');
				tr.append(td);
				let dataId = buffer.readUInt32LE(19);
				td.textContent = hex(dataId)+':';
				td.style.setProperty('font-weight', 'normal');
				td.style.setProperty('font-size', '13px');
				td.style.setProperty('font-family', 'Arial');

				td = document.createElement('td');
				table.append(tr);
				tr.append(td);
				let pre = document.createElement('pre');
				let header = chunk(format, buffer.toString('hex', 0, 55));
				pre.textContent = header;
				pre.style.setProperty('font-size', '12px');
				td.append(pre);

				grid.parse(new Stream(buffer));

				let arr = grid.createProxy();
				td = document.createElement('td');
				tr.append(td);

				let canvas = grid.paint();
				td.append(canvas);
				canvas.style.setProperty('border', 'deeppink 1px solid');

			}

		}

	});

	it.skip('should remove the simgrid from a city', async function() {

		let source = path.resolve(__dirname, 'files/City - grid.sc4');
		let out = path.resolve(REGION, 'City - grid.sc4');
		let dbpf = new Savegame(fs.readFileSync(source));

		let cut = 39;

		let entry = dbpf.getByType(0x49b9e602);
		let buff = entry.decompress();
		let all = split(buff);
		all.splice(cut, 1);

		entry.raw = Buffer.concat(all);
		entry.compressed = false;

		// let index = dbpf.entries.indexOf(entry);
		// dbpf.entries.splice(index, 1);

		await dbpf.save({"file": out});

	});

});

// List:
// 0x49d5bc86: "Power"