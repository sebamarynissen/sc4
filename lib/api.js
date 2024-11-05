// # api.js
// Contains the JavaScript api of the cli. This separates concerns nicely: the 
// api does the actual job, while the cli is merely responsible for the 
// options parsing.
"use strict";
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DBPF, Savegame, FileType } = require('sc4/core');
const { hex } = require('#core/util.js');

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
		await dbpf.save({ file: opts.output });
	}

	opts.ok('Done');

	return dbpf;

};

// # growify(opts)
exports.growify = async function(opts) {
	
	// Defaultize options.
	opts = Object.assign(Object.create(baseOptions), opts);
	let dbpf = open(opts.dbpf);

	// Get the SimGrid with the ZoneData information because that needs to be 
	// updated as well.
	const ZoneData = 0x41800000;
	let grid = dbpf.getSimGrid(FileType.SimGridSint8, ZoneData);

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
	for (let lot of dbpf.lotFile) {
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
		opts.warn('No plopped buildings found to growify!');
		return dbpf;
	}

	opts.ok(`Growified ${rCount} residentials, ${cCount} commercials, ${iCount} industrials & ${aCount} agriculturals`);

	// Save if we have to
	if (opts.save) {
		opts.info(`Saving to ${opts.output}`);
		await dbpf.save({ file: opts.output });
	}

	opts.ok('Done');

	return dbpf;

};

// # refs(opts)
exports.refs = async function(opts) {

	opts = Object.assign(Object.create(baseOptions), opts);
	let dbpf = opts.dbpf;

	if (opts.address) {

		opts.info('Searching for', opts.address.map(hex).join(', '));
		let result = dbpf.memSearch(opts.address);
		for (let i = 0; i < result.length; i++) {
			opts.info(`${hex(opts.address[i])} was found in:`);
			console.table(result[i].map(x => x.class));
		}

	} else {

		// Find all entries that have a memory field, but only the ones we're 
		// interested in.
		let queries = opts.queries;
		let types = Object.values(queries);
		let refs = dbpf.memRefs().filter(row => types.includes(row.type));
		let oLength = refs.length;

		// Put a maximum on the types of refs, especially for the large city 
		// here. Group by type for this.
		refs = refs.reduce(function(mem, ref) {
			(mem[ ref.type ] || (mem[ ref.type ] = [])).push(ref);
			return mem;
		}, {});

		let max = opts.max || Infinity;
		for (let type in refs) {
			let arr = refs[type];
			arr.length = Math.min(max, arr.length);
		}
		refs = Object.values(refs).reduce(function(mem, arr) {
			mem.push(...arr);
			return mem;
		}, []);

		opts.info('Searching for', Object.keys(queries).join(', '));
		opts.info(`Searching ${refs.length} refs (${ Math.round(10000*refs.length / oLength)/100}%)`);
		let start = new Date();
		opts.info('Started at', start.toTimeString());

		// Now search for all these refs.
		let result = dbpf.memSearch(refs.map(ref => ref.mem));

		// Now group per type.
		let groups = {};
		for (let key in queries) {
			groups[ queries[key] ] = new Set();
		}
		for (let i = 0; i < result.length; i++) {
			let ref = refs[i];
			let set = groups[ ref.type ];
			let row = result[i];
			for (let cell of row) {
				set.add(cell.class);
			}
		}

		opts.ok('Took', String((new Date() - start)/1000)+'s');

		// Log.
		for (let type in queries) {
			opts.info(`${type} references were found in:`);
			console.table([...groups[ queries[type] ]].sort());
		}

	}

}

// # pointer(opts)
exports.pointer = async function(opts) {
	let {
		dbpf,
		pointer,
	} = { ...baseOptions, ...opts };

	opts.info('Searching for', hex(opts.pointer));
	let refs = dbpf.memRefs();
	let entry = refs.find(ref => {
		return ref.mem === pointer;
	});
	if (!entry) {
		opts.error('Pointer not found!');
		return;
	}

	// Check if it matches a specific file type.
	let name = '';
	for (let [key, value] of Object.entries(FileType)) {
		if (value === entry.type) {
			name = ` (${key})`;
			break;
		}
	}

	opts.ok(`Found in ${hex(entry.type)}${name}`);

};

// # duplicates(opts)
// Finds duplicates files in a plugin folder.
exports.duplicates = function(opts) {
	let { folder } = opts;
	let start = path.resolve(process.cwd(), folder);
	let map = new Map();

	function dive(dir) {
		let contents = fs.readdirSync(dir);
		for (let entry of contents) {
			entry = path.join(dir, entry);
			let stat = fs.statSync(entry);
			if (stat.isDirectory()) {
				dive(entry);
			} else {
				let buffer = fs.readFileSync(entry);
				let sha = hash(buffer);
				if (map.has(sha)) {
					let arr = map.get(sha);
					arr.push(entry);
				} else {
					map.set(sha, [entry]);
				}
			}
		}
	}
	opts.info('Reading plugins folder');
	dive(start);

	// Now log all duplicates.
	for (let files of map.values()) {
		if (files.length === 1) continue;
		let out = files.map(full => path.relative(start, full));
		console.log(out);
	}

};

// # DBPF()
// Export the dbpf as well.
exports.DBPF = DBPF;
exports.Savegame = Savegame;

// An object containing some default options, such as the logging functions 
// etc.
const baseOptions = {
	ok: noop,
	info: noop,
	warn: noop,
	error: noop
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

// # hash(buffer)
// Returns the sha256 hash of a buffer.
function hash(buffer) {
	const hash = crypto.createHash('sha256');
	hash.update(buffer);
	return hash.digest('hex');
}
