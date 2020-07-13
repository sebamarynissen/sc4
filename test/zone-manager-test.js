// # zone-manager-test.js
"use strict";
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const Stream = require('../lib/stream.js');
const Savegame = require('../lib/savegame.js');
const { hex, chunk } = require('../lib/util');
const { FileType, cClass } = require('../lib/enums.js');
const CityManager = require('../lib/city-manager.js');
const HOME = process.env.HOMEPATH;
const PLUGINS = path.resolve(HOME, 'documents/SimCity 4/plugins');
const REGION = path.resolve(HOME, 'documents/SimCity 4/regions/experiments');
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

		const FileIndex = require('../lib/file-index.js');

		let out = path.join(REGION, 'City - Growth.sc4');
		let one = path.join(dir, 'City - Growth - 1.sc4');
		let two = new Savegame(path.join(dir, 'City - Growth - 2.sc4'));

		let c = 'c:/GOG Games/SimCity 4 Deluxe Edition';
		// let index = new FileIndex(nybt);
		let index = new FileIndex({
			files: [
				path.join(c, 'SimCity_1.dat'),
				path.join(c, 'SimCity_2.dat'),
				path.join(c, 'SimCity_3.dat'),
				path.join(c, 'SimCity_4.dat'),
				path.join(c, 'SimCity_5.dat'),
			],
			dirs: [
				PLUGINS,
			],
		});
		await index.build();

		let city = new CityManager({ index });
		city.load(one);
		for (let i = 0; i < 10; i++) {
			let lot = city.grow({
				tgi: [0x6534284a,0xa8fbd372,0xa706ed25],
				x: 3+i,
				z: 1,
				orientation: 2,
			});
		}

		await city.save({ file: out });

	});

});