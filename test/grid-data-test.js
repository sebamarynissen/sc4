// # grid-data-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const REGION = require('./test-region');
const Savegame = require('../lib/savegame');
const SimGrid = require('../lib/sim-grid');
const { split, chunk, hex } = require('../lib/util');

describe('The grid data object', function() {

	it.only('should read parse from a buffer', function() {

		// let source = path.resolve(REGION, 'City - grid.sc4');
		let source = path.resolve(__dirname, 'files/city - grid.sc4');
		let dbpf = new Savegame(fs.readFileSync(source));

		let types = {
			"UInt8": 0x49b9e602,
			"SInt8": 0x49b9e603,
			"UInt16": 0x49b9e604,
			"Int16": 0x49b9e605,
			"UInt32": 0x49b9e606,
			"Float32": 0x49b9e60a
		};

		document.querySelector('#view').remove();
		document.querySelector('#mocha').remove();

		for (let type in types) {
			let num = types[type];

			let entry = dbpf.getByType(num);
			let buffers = split(entry.read());
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
				let grid = new SimGrid();

				let td;
				let tr = document.createElement('tr');
				td = document.createElement('td');
				tr.append(td);
				td.textContent = String(i)+':';
				td.style.setProperty('font-weight', 'bold');
				td.style.setProperty('font-family', 'Arial');

				td = document.createElement('td');
				table.append(tr);
				tr.append(td);
				let pre = document.createElement('pre');
				let header = chunk(format, buffer.toString('hex', 0, 55));
				pre.textContent = header;
				td.append(pre);

				grid.parse(buffer);

				let arr = grid.createProxy();
				td = document.createElement('td');
				tr.append(td);

				let canvas = grid.paint();
				td.append(canvas);
				canvas.style.setProperty('border', 'deeppink 1px solid');

			}

		}

	});

	it.only('should remove the simgrid from a city', async function() {

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