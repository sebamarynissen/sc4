// # api.js
// Contains the JavaScript api of the cli. This separates concerns nicely: the 
// api does the actual job, while the cli is merely responsible for the 
// options parsing.
import { fs } from 'sc4/utils';
import { Savegame, SimGrid } from 'sc4/core';

// # historical(opts)
// The api function that makes buildings historical within a savegame.
export async function historical(opts = {}) {
	
	// Defaultize options.
	const { logger = defaultLogger } = opts;
	let dbpf = open(opts.dbpf);

	let i = 0;
	for (let lot of dbpf.lots) {

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
		logger.warn('No lots found to make historical');
		return dbpf;
	}

	logger.ok(`Marked ${i} lots as historical`);

	// Save if we have to.
	if (opts.save) {
		// If a backup function was specified, we'll first call it.
		if (opts.backup && typeof opts.dbpf === 'string') {
			await opts.backup(opts.dbpf, opts);
		}
		let { output = opts.dbpf } = opts;
		logger.info(`Saving to ${output}`);
		await dbpf.save({ file: output });
	}

	logger.ok('Done');
	return dbpf;

}

// # growify(opts)
export async function growify(opts = {}) {
	
	// Defaultize options.
	const { logger = defaultLogger } = opts;
	let dbpf = open(opts.dbpf);

	// Get the SimGrid with the ZoneData information because that needs to be 
	// updated as well.
	let grid = dbpf.getSimGrid(SimGrid.ZoneData);

	// Helper function that will update the zoneType in the SimGrid as well 
	// when growifying.
	const { historical } = opts;
	function setType(lot, zoneType) {
		lot.zoneType = zoneType;
		for (let x = lot.minX; x <= lot.maxX; x++) {
			for (let z = lot.minZ; z <= lot.maxZ; z++) {
				grid.set(x, z, zoneType);
			}
		}

		// See #8. If we need to make the lot historical by default, do it.
		if (historical) {
			lot.historical = true;
		}

	}

	let rCount = 0, cCount = 0, iCount = 0, aCount = 0;
	for (let lot of dbpf.lots) {
		if (opts.residential && lot.isPloppedResidential) {
			setType(lot, opts.residential);
			rCount++;
		} else if (opts.commercial && lot.isPloppedCommercial) {
			setType(lot, opts.commercial);
			cCount++;
		} else if (opts.industrial && lot.isPloppedIndustrial) {
			setType(lot, opts.industrial);
			iCount++;
		} else if (opts.agricultural && lot.isPloppedAgricultural) {
			setType(lot, opts.agricultural);
			aCount++;
		}
	}

	// No plopped buildings found? Exit.
	if (rCount + cCount + iCount + aCount === 0) {
		logger.warn('No plopped buildings found to growify!');
		return dbpf;
	}

	logger.ok(`Growified ${rCount} residentials, ${cCount} commercials, ${iCount} industrials & ${aCount} agriculturals`);

	// Save if we have to
	if (opts.save) {

		// If a backup function was specified, we'll first call it.
		if (opts.backup && typeof opts.dbpf === 'string') {
			await opts.backup(opts.dbpf, opts);
		}
		let { output = opts.dbpf } = opts;
		logger.info(`Saving to ${output}`);
		await dbpf.save({ file: output });
	}

	logger.ok('Done');

	return dbpf;

}

// An object containing some default options, such as the logging functions 
// etc.
const defaultLogger = {
	ok: noop,
	info: noop,
	warn: noop,
	error: noop,
	log: noop,
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
