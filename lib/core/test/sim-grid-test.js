// # sim-grid-test.js
'use strict';
const { expect } = require('chai');
const fs = require('node:fs');
const { Savegame, FileType } = require('sc4/core');
const resource = require('#test/get-test-file.js');

describe('A SimGrid', function() {

	it('should parse & serialize correctly', function() {

		let source = resource('city - large developed.sc4');
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
				let power = grids.find(grid => grid.dataId === POWER);
				expect(power).to.be.ok;
			}

			// Serialize each grid independently.
			for (let grid of grids) {
				let crc = grid.crc;
				let buff = grid.toBuffer();
				expect(buff.readUInt32LE(4)).to.equal(crc);
			}

			// Check the entire grid.
			let check = entry.decompress();
			expect(check.toString('hex')).to.equal(entry.buffer.toString('hex'));

		}

	});

});