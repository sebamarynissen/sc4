// # api.js
// Contains the JavaScript api of the cli. This separates concerns nicely: the 
// api does the actual job, while the cli is merely responsible for the 
// options parsing.
"use strict";
const fs = require('fs');
const DBPF = require('./dbpf');
const Savegame = require('./savegame');

// # historical(opts)
// The api function that makes buildings historical within a savegame.
exports.historical = async function(opts) {
	
	// Defaultize options.
	opts = Object.assign(Object.create(baseOptions), opts);
	let dbpf = open(opts.dbpf);

	let i = 0;
	for (let lot of dbpf.lotFile) {

		// Skip lots that are already historical.
		if (lot.historical) continue;

		// Make historical if we have to.
		if (
			opts.all ||
			(opts.residential && lot.isResidential) ||
			(opts.commercial && lot.isCommercial) ||
			(opts.agricultural && lot.isAgricultural) ||
			(opts.industrial && lot.isIndustrial)
		) {
			i++;
			lot.historical = true;
		}

	}

	// No lots found? Don't re-save.
	if (i === 0) {
		opts.warn('No lots found to make historical');
		return dbpf;
	}

	opts.ok(`Marked ${i} lots as historical`);

	// Save if we have to.
	if (opts.save) {
		opts.info(`Saving to ${opts.output}`);
		await dbpf.save({"file": opts.output});
	}

	opts.ok('Done');

	return dbpf;

};

// # growify(opts)
exports.growify = async function(opts) {
	
	// Defaultize options.
	opts = Object.assign(Object.create(baseOptions), opts);
	let dbpf = open(opts.dbpf);

	let rCount = 0, iCount = 0, aCount = 0;
	for (let lot of dbpf.lotFile) {
		if (opts.residential && lot.isPloppedResidential) {
			lot.zoneType = opts.residential;
			rCount++;
		} else if (opts.industrial && lot.isPloppedIndustrial) {
			lot.zoneType = opts.industrial;
			iCount++;
		} else if (opts.agricultural && lot.isPloppedAgricultural) {
			lot.zoneType = opts.agricultural;
			aCount++;
		}
	}

	// No plopped buildings found? Exit.
	if (rCount + iCount + aCount === 0) {
		opts.warn('No plopped buildings found to growify!');
		return dbpf;
	}

	opts.ok(`Growified ${rCount} residentials, ${iCount} industrials & ${aCount} agriculturals`);

	// Save if we have to
	if (opts.save) {
		opts.info(`Saving to ${opts.output}`);
		await dbpf.save({"file": opts.output});
	}

	opts.ok('Done');

	return dbpf;

};

// # DBPF()
// Export the dbpf as well.
exports.DBPF = DBPF;
exports.Savegame = Savegame;

// An object containing some default options, such as the logging functions 
// etc.
const baseOptions = {
	"ok": noop,
	"info": noop,
	"warn": noop,
	"error": noop
};

// # open(dbpf)
// Helper function that opens up a savegame file.
function open(dbpf) {
	if (typeof dbpf === 'string') {
		dbpf = new Savegame(fs.readFileSync(dbpf));
	}
	return dbpf;
}

// # noop()
// Does nothing.
function noop() {}