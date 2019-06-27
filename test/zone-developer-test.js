// # zone-developer-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const Savegame = require('../lib/savegame');
const { FileType } = require('../lib/enums');
const { chunk } = require('../lib/util');

describe('The ZoneDeveloper Subfile', function() {

	it('should read small city tiles', function() {
		let file = path.resolve(__dirname, 'files/City - RCI.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let dev = dbpf.zoneDeveloperFile;
		expect(dev.xSize).to.equal(64);
		expect(dev.zSize).to.equal(64);
		expect(dev.cells).to.have.length(64);
		for (let column of dev.cells) {
			expect(column).to.have.length(64);
			for (let cell of column) {
				if (cell) {
					expect(cell).to.have.property('mem');
					expect(cell).to.have.property('type');
				}
			}
		}

		// Now serialize again & check that the CRC still matches.
		let crc = dev.crc;
		let buff = dev.toBuffer();
		expect(buff.readUInt32LE(4)).to.equal(crc);

	});

	it('should read medium city tiles', function() {

		let file = path.resolve(__dirname, 'files/City - Medium.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let entry = dbpf.getByType(FileType.ZoneDeveloperFile);
		let dev = entry.read();
		expect(dev.xSize).to.equal(128);
		expect(dev.zSize).to.equal(128);
		expect(dev.cells).to.have.length(128);
		for (let column of dev.cells) {
			expect(column).to.have.length(128);
			for (let cell of column) {
				if (cell) {
					
					// Apparently expect assertions are slow (don't know why), 
					// so assert manually.
					if (cell.mem === 0) throw new Error();
					if (cell.type !== FileType.LotFile) throw new Error('Not a lot!');
				}
			}
		}

		// Now serialize again & check that the CRC still matches.
		let crc = dev.crc;
		let buff = dev.toBuffer();
		expect(buff.readUInt32LE(4)).to.equal(crc);

	});

	it('should read large city tiles', function() {

		let file = path.resolve(__dirname, 'files/city.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let entry = dbpf.getByType(FileType.ZoneDeveloperFile);
		let dev = entry.read();
		expect(dev.xSize).to.equal(256);
		expect(dev.zSize).to.equal(256);
		expect(dev.cells).to.have.length(256);
		for (let column of dev.cells) {
			expect(column).to.have.length(256);
			for (let cell of column) {
				if (cell) {
					
					// Apparently expect assertions are slow (don't know why), 
					// so assert manually.
					if (cell.mem === 0) throw new Error();
					if (cell.type !== FileType.LotFile) throw new Error('Not a lot!');
				}
			}
		}

		let check = entry.decompress();
		let buff = dev.toBuffer();

		let format = '4 4 4 2 4 4'.split(' ').map(x => 2*(+x));
		console.log(chunk(format, check.slice(0, 22).toString('hex')));
		console.log(chunk(format, buff.slice(0, 22).toString('hex')));

		// Now serialize again & check that the CRC still matches.
		// let crc = dev.crc;
		// let buff = dev.toBuffer();
		// expect(buff.readUInt32LE(4)).to.equal(crc);

	});

});