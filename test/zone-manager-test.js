// # zone-manager-test.js
"use strict";
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const Stream = require('../lib/stream.js');
const Savegame = require('../lib/savegame.js');
const { hex, chunk } = require('../lib/util');
const { FileType, cClass } = require('../lib/enums.js');
const REGION = path.resolve(process.env.HOMEPATH, 'Documents/SimCity 4/Regions/Experiments');
const dir = path.resolve(__dirname, 'files');

describe('The zone manager file', function() {

	it('is parsed & serialized correctly', function() {
		this.timeout(0);
		let file = path.join(dir, 'city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new Savegame(buff);
		let entry = dbpf.getByType(FileType.ZoneManager);
		let zm = entry.read();

		// Check that the input buffer matches the out buffer exactly.
		let { crc } = zm;
		let out = zm.toBuffer();
		expect(out).to.eql(entry.decompress());

	});

	it('is decoded', async function() {

		// let file = path.join(REGION, 'City - Growth.sc4');
		// let dbpf = new Savegame(file);
		let one = new Savegame(path.join(REGION, 'City - Growth.sc4'));
		// let one = new Savegame(path.resolve(REGION, '../New Delphina/City - Strateigia.sc4'));
		// let two = new Savegame(path.join(REGION, 'City - Growth.sc4'));

		const crc32 = require('../lib/crc.js');
		let entry = one.entries.find(entry => entry.type === 0x298f9b2d);
		// for (let entry of one) {
			let buff = entry.decompress();
			let size = buff.readUInt32LE();
			let slice = buff.slice(0, size);
			let crc = crc32(slice, 8);
			if (crc !== buff.readUInt32LE(4)) {
				console.log(types[ entry.type ]);
			}
		// }

		let rs = new Stream(buff);

		// let header = buff.slice(0, 14);
		let header = rs.read(14);
		console.log(chunk([8, 8, 8, 4], header.toString('hex')));

		let n = 23;
		for (let i = 0; i < n; i++) {
			// let slice = body.slice(32*i, 32*i+32);
			let slice = rs.read(32);
			let format = Array(8).fill(8);
			console.log(chunk(format, slice.toString('hex')));
		}
		console.log(rs.read(1).toString('hex'));
		for (let i = 0; i < 5; i++) {
			let slice = rs.read(8);
			console.log(chunk([8, 8], slice.toString('hex')));
		}

		// console.log(buff.toString('hex'));
		// console.log(slice.toString('hex').length);

		return;

		for (let type of [FileType.SimGridSint8]) {

			let { grids } = one.readByType(type);
			console.log('LENGTH', grids.length);
			console.log(grids[0].dataId.toString(16));

			function fill(grid, x=1) {
				let { dataId } = grid;
				// console.log('DATA ID', hex(dataId));
				grid.data.fill(x);
			}
			fill(grids[0], 1);
			// for (let i = 0; i < grids.length; i++) {
			// 	fill(grids[i], 1);
			// }

		}

		await one.save({ file: path.join(REGION, 'City - Growth.sc4') });

	});

});