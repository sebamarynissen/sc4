// # zone-manager-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import Stream from '../lib/core/stream.js';
import { Savegame, FileType, cClass } from 'sc4/core';
import { hex, chunk } from 'sc4/utils';
import CityManager from '../lib/api/city-manager.js';
import FileIndex from '../lib/api/file-index.js';
const HOME = process.env.HOMEPATH;
const PLUGINS = path.resolve(HOME, 'documents/SimCity 4/plugins');
const REGION = path.resolve(HOME, 'documents/SimCity 4/regions/experiments');
const dir = path.resolve(import.meta.dirname, 'files');

describe('The zone manager file', function() {

	it.skip('is parsed & serialized correctly', function() {
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
				tgi: [0x6534284a, 0xa8fbd372, 0xa706ed25],
				x: 3+i,
				z: 1,
				orientation: 2,
			});
		}

		await city.save({ file: out });

	});

});
