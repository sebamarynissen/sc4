// # seasonal-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const path = require('path');
const fs = require('fs');
const dir = path.resolve(process.env.HOMEPATH, 'documents/simcity 4/plugins');
const DBPF = require('../lib/dbpf');
const Savegame = require('../lib/savegame');
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
		// let city = path.resolve(__dirname, 'files/city.sc4');
		let dbpf = new Savegame(city);
		let flora = dbpf.floraFile;

		let datefile = dbpf.entries.find(entry => entry.type === 0x2990C1E5);
		let buff = datefile.read();

		const { getUnixFromJulian } = require('../lib/julian-date');
		let date = new Date(getUnixFromJulian(buff.readUInt32LE(buff.length-4)));

		let i = 0;
		for (let item of flora) {

			// Synchronize everything to September 1st.
			let date = item.appearanceDate;
			date.setMonth(0);
			date.setDate(15);
			// if (date > item.cycleDate) {
				date.setFullYear(date.getFullYear()-1);
			// }
			item.appearanceDate = date;

			item.cycleDate.setTime(date.getTime());

		}

		let out = path.join(REGION, 'City - Out of sync.sc4');
		dbpf.save({"file": out});

	});

	it.skip('should create static season mods', function() {

		function extract(dir) {
			let files = fs.readdirSync(dir);
			let seasonal = files.find(file => file.match(/seasonal/i));
			if (!seasonal) {
				console.warn(`Did not find seasonal flora in ${dir}!`);
				return;
			}

			// Open as dbpf & find all exemplars.
			let dbpf = new DBPF(path.join(dir, seasonal));
			let exemplars = dbpf.exemplars
				.sort((a, b) => a.instance - b.instance)
				.map(x => x.read());

			// Find the RKT 4 of each exemplar.
			let maps = exemplars.map(exemplar => {
				let rkt = exemplar.table[0x27812824].value;

				// Split up each entry.
				let reps = [];
				while (rkt.length) {
					reps.push(rkt.slice(0, 8));
					rkt = rkt.slice(8);
				}
				reps.sort((a, b) => a[0] - b[0]);
				let iids = reps.map(x => x[6]);
				let map = {};

				// If we have 3, it's fall, winter, summer.
				const { hex } = require('../lib/util');
				if (iids.length !== 3) {
					[map.fall, map.winter, map.spring, map.summer] = iids;
				} else {
					map.spring = map.summer = iids[2];
					map.fall = iids[0];
					map.winter = iids[1];
				}

				return map;

			});

			// Now read in the evergreen exemplar as well.
			let evergreen = files.find(file => file.match(/(summer|evergreen)/i));
			if (!evergreen) {
				return console.warn(`No evergreen flora found in ${dir}!`);
			}

			// Read in all exemplars again and sort as well.
			let sub = path.basename(dir);
			dbpf = new DBPF(path.join(dir, evergreen));
			exemplars = dbpf.exemplars
				.sort((a, b) => a.instance - b.instance)
				.map(entry => entry.read());

			// Now save a file for every season.
			for (let season of ['fall', 'winter', 'spring','summer']) {
				exemplars.map((exemplar, i) => {
					let iid = maps[i][season];
					let prop = exemplar.table[0x27812821];
					prop.value[1] = iid;
				});

				let name = evergreen.replace(/(summer|evergreen)/i, season.toUpperCase());
				name = 'zzz_'+name;

				// Save.
				const DESKTOP = path.resolve(process.env.HOMEPATH, 'desktop');
				let out = path.join(DESKTOP, 'Girafe', season, name);
				dbpf.save({"file": out});

			}

		}

		let girafe = path.join(dir, 'BSC/girafe');
		fs.readdirSync(girafe).map(function(entry) {
			let dir = path.join(girafe, entry);
			extract(dir);
		});

		// Read in the faguses as well.
		let fagus = path.join(dir, 'VIP/Orange/VIP_Or_Fagus');
		extract(fagus);

	});

});