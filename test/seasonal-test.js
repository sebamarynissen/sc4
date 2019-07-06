// # seasonal-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const path = require('path');
const fs = require('fs');
const dir = path.resolve(process.env.HOMEPATH, 'documents/simcity 4/plugins');
const DBPF = require('../lib/dbpf');
const Savegame = require('../lib/savegame');
const JulianDate = require('../lib/julian-date');
const REGION = require('./test-region');

describe('Making trees no longer seasonal', function() {

	it.skip('should map seasonal to evergreen', function() {

		let pairs = [];
		function pair(dir, alt) {

			// Find the seasonal & evergreen entries.
			let contents = fs.readdirSync(dir);
			let seasonalDir = alt ? fs.readdirSync(alt) : contents;
			let dirs = [dir, alt || dir];

			let evergreen = contents.find(x => x.match(/(summer|evergreen)/i));
			let seasonal = seasonalDir.find(x => x.match(/seasonal/i));
			if (!evergreen || !seasonal) return;

			// Read both files & order them.
			let mapped = [evergreen, seasonal].map(function(file, i) {

				file = path.join(dirs[i], file);
				let dbpf = new DBPF(fs.readFileSync(file));

				// Find all exemplar ids.
				return dbpf.exemplars.map(entry => entry.instance);

			});

			// Check that both have the same length.
			if (mapped[0].length !== mapped[1].length) {
				console.log('length mismatch!');
			}

			for (let i = 0; i < mapped[0].length; i++) {
				pairs.push({
					"evergreen": mapped[0][i],
					"seasonal": mapped[1][i]
				});
			}

		}

		let girafe = path.join(dir, 'BSC/girafe');
		fs.readdirSync(girafe).map(function(entry) {
			let dir = path.join(girafe, entry);
			pair(dir);
		});

		// Read in the faguses as well.
		let fagus = path.join(dir, 'VIP/Orange/VIP_Or_Fagus');
		pair(fagus);

		// Maples are handled differently because they are in separate folders 
		// apparently.
		pair(path.join(girafe, 'maples'), path.join(girafe, 'maples v2'));

		// Cool, create a map from it, seasonal to summer so that we can test 
		// it.
		let map = new Map();
		for (let pair of pairs) {
			map.set(pair.seasonal, pair.evergreen);
		}

		// Now read in the city.
		let city = path.resolve(__dirname, 'files/City - Four Seasons.sc4');
		let dbpf = new Savegame(city);
		let flora = dbpf.floraFile;

		for (let item of flora) {
			let iid = item.IID;
			if (map.has(iid)) {
				iid = map.get(iid);
				item.IID = item.IID1 = iid;
			}
		}

		let out = path.join(REGION, 'City - Four Seasons.sc4');
		dbpf.save({"file": out});

	});

	it.skip('should synchronize flora', function() {

		let city = path.resolve(__dirname, 'files/City - Out of sync.sc4');
		let dbpf = new Savegame(city);
		let flora = dbpf.floraFile;

		for (let item of flora) {

			// Set to first of september 2000.
			item.appearanceDate = item.cycleDate = 2451789;
			// item.appearanceDate = item.cycleDate = 2451809;

		}

		let out = path.join(REGION, 'City - Out of sync.sc4');
		dbpf.save({"file": out});

	});

	it.skip('should override the Fagus', function() {

		// Evergreen exemplars, mapping to [fall, winter, spring]
		let map = {
			"vip/orange/vip_or_fagus/vip_or_fagus_summer.dat": [
				0xfbd95afe
			]
		};

		let fagus = path.join(dir, 'vip/orange/vip_or_fagus/vip_or_fagus_summer.dat');
		let dbpf = new DBPF(fagus);
		dbpf.exemplars.map(function(entry) {
			let file = entry.read();
			file.table[0x27812821].value[1] = 0xfbd95afe;
		});

		// Save
		dbpf.save({"file": path.join(dir, 'vip/orange/vip_or_fagus/zz_vip_or_fagus_summer.dat')});

	});

});