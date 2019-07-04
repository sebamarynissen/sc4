// # city-manager.js
"use strict";
const path = require('path');
const fs = require('fs');
const Savegame = require('./savegame');
const Index = require('./index');
const SC4 = path.resolve(process.env.HOMEPATH, 'documents/SimCity 4');
const regions = path.join(SC4, 'regions');
const plugins = path.join(SC4, 'plugins');

// # CityManager
class CityManager {

	// ## constructor(dbpf)
	// Sets up the city manager.
	constructor(dbpf) {
		
		// If we've received a string, treat it as a path.
		if (typeof dbpf === 'string') {
			let file = path.resolve(regions, dbpf);

			// No extension given? Add .sc4
			let ext = path.extname(file);
			if (ext !== '.sc4') file += '.sc4';

			// Check if the file exists. If it doesn't exist, then try again 
			// with "City - " in front.
			if (!fs.existsSync(file)) {
				let name = path.basename(file);
				let dir = path.dirname(file);
				file = path.join(dir, 'City - '+name);
				if (!fs.existsSync(file)) {
					throw new Error(`City "${dbpf}" could not be found!`);
				}
			}

			// Create the city.
			dbpf = new Savegame(fs.readFileSync(file));

		}

	}

	// ## loadPlugins(opts)
	async loadPlugins(opts) {
		if (!opts) {
			opts = {
				"dirs": [plugins]
			}
		}

		// Build the index.
		let index = this.plugins = new Index(opts);
		await index.build();

	}

}

module.exports = CityManager;