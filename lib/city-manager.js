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
		
		// Pre-initialize all fields.
		this.dbpf = null;
		this.memRefs = null;
		this.$mem = 1;

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
			dbpf = this.dbpf = new Savegame(fs.readFileSync(file));

		} else {
			this.dbpf = dbpf;
		}

	}

	// ## mem()
	// Returns an unused memory address. This is useful if we add new stuff to 
	// a city - such as buildings etc. - because we need to make sure that the 
	// memory addresses for every record are unique.
	mem() {

		// If we didn't set up the memory references yet, parse them.
		if (!this.memRefs) {
			let { dbpf } = this;
			let set = this.memRefs = new Set();
			for (let { mem } of dbpf.memRefs()) {
				set.add(mem);
			}
		}

		// Create a new memory reference, but make sure it doesn't exist yet.
		let ref = this.$mem++;
		while (this.memRefs.has(ref)) {
			ref = this.$mem++;
		}
		this.memRefs.add(ref);
		return ref;

	}

	// ## loadPlugins(opts)
	// Loads a plugins directory and sets an index. This index will be at the 
	// heart of everything we'll be doing because it allows us to query 
	// entries by TGI. Note that we have to make sure to index the 
	// SimCity_1.dat files as well!
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