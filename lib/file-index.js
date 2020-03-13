// # file-index.js
"use strict";
const fs = require('fs');
const path = require('path');
const os = require('os');
const bsearch = require('binary-search-bounds');
const LRUCache = require('lru-cache');
const {default:PQueue} = require('p-queue');
const DBPF = require('./dbpf.js');
const { FileType } = require('./enums.js');

const Family = 0x27812870;

// Patch fs promises.
if (!fs.promises) {
	const util = require('util');
	fs.promises = { readFile: util.promisify(fs.readFile) };
}

// # FileIndex
// The file index is a data structure that scans a list of dbpf files and 
// builds up an index of all files in it by their TGI's. This should mimmick 
// how the game scans the plugins folder as well. We obivously cannot keep 
// everything in memory so we'll keep pointers to where we can find each file 
// **on the disk**. Note: we should make use of node's async nature here so 
// that we can read in as much files as possible in parallel!
class FileIndex {

	// ## constructor(opts)
	constructor(opts = {}) {

		// Set up the cache that we'll use to free up memory of DBPF files 
		// that are not read often.
		let { mem = Number(os.totalmem) } = opts;
		this.cache = new LRUCache({
			max: 0.5*mem,
			length(n, dbpf) {
				return dbpf.buffer.byteLength;
			},
			dispose(dbpf, n) {
				dbpf.free();
			},
		});

		// Our array containing all our records. This array will be sorted by 
		// tgi.
		this.records = null;

		// We'll also keep track of all exemplar records because we'll often 
		// need them and it can be cumbersome to loop just about everything.
		this.exemplars = [];

		// A map that contains references to all building & prop families. 
		// Note that we cannot use a separate data structure for this because 
		// the order in which files get loaded is important here!
		this.families = new Map();

		// If the options are simply given as a string, consider it to be a 
		// directory.
		if (typeof opts === 'string') {
			opts = { dirs: [opts] };
		}

		// No directory or files specified? Use the default plugins directory.
		// Note that we should look for the SimCity_1.dat core files as well 
		// of course.
		if (!opts.files && !opts.dirs) {
			let plugins = path.join(
				process.env.HOMEPATH,
				'Documents/SimCity 4/Plugins',
			);
			opts = Object.assign({
				dirs: [plugins],
			}, opts);
		}

		let files = this.files = [];
		if (opts.files) {
			files.push(...opts.files);
		}

		// Scan directories as well.
		if (opts.dirs) {
			for (let dir of opts.dirs) {
				collect(dir, files);
			}
		}

	}

	// ## get length()
	get length() {
		return this.records.length;
	}

	// ## async build(opts)
	// Builds up the index.
	async build(opts = {}) {

		// Initialize our records array.
		this.records = [];

		// Limit the amount of reads that we carry out.
		let cpus = os.cpus();
		let max = Math.max(2, cpus.length, opts.concurrency || 0);
		let Q = new PQueue({ concurrency: max });
		let all = [];
		for (let file of this.files) {

			// Note: SC4 doesn't work this way, but we are going to ignore any 
			// extensions other than .dat, sc4desc, sc4model & sc4lot for now.
			let ext = path.extname(file).toLowerCase().slice(1);
			if (!extRegex.test(ext)) continue;

			// Add to the index.
			let task = Q.add(() => this.addToIndex(file));
			all.push(task);

		}
		await Promise.all(all);

		// Allright we now have all records. Time to sort them in their 
		// respective arrays.
		this.records.sort(compare);

		// Loop all exemplars so that we can find the building and prop 
		// families.
		for (let entry of this.exemplars) {
			let file = entry.read();
			let family = this.getPropertyValue(file, Family);
			if (family) {
				let [IID] = family;
				let arr = this.families.get(IID);
				if (!arr) {
					this.families.set(IID, arr = []);
				}
				arr.push(entry);
			}
		}

	}

	// ## async addToIndex(file)
	// Asynchronously adds the given file to the index. Note that this is not 
	// meant for external use as this doesn't sort the records!
	async addToIndex(file) {

		// Asynchronously load read in the file to add. As such we can make 
		// use of the OS's multithreading for reading files, even though JS is 
		// single threaded.
		let buff = await fs.promises.readFile(file);
		
		// Ensure that the file is a dbpf file, ignore otherwise.
		if (buff.toString('utf8', 0, 4) !== 'DBPF') {
			return;
		}

		// Parse the DBPF.
		let dbpf = new DBPF(buff);
		dbpf.file = file;
		for (let entry of dbpf.entries) {
			this.records.push(entry);

			// If the entry is an exemplar, push it in all our exemplars. Note 
			// that we don't read it yet and check for a family: we need to 
			// have access to **all** exemplars first!
			if (entry.type === FileType.Exemplar) {
				this.exemplars.push(entry);
			}

		}

		// Important! Make sure to free the buffer, otherwise the `read` 
		// handler still has access to it and won't ever be cleared from 
		// memory!
		buff = null;

		// Note done yet. Listen to how many times the entries of the DBPF are 
		// read so that we can update the cache with it.
		this.cache.set(dbpf);
		dbpf.on('read', () => {
			if (!this.cache.has(dbpf)) {
				if (!dbpf.buffer) {
					dbpf.load();
				}
				this.cache.set(dbpf);
			}
		});

	}

	// ## find(type, group, instance)
	// Finds the record identified by the given tgi
	find(type, group, instance) {
		if (Array.isArray(type)) {
			[type, group, instance] = type;
		} else if (typeof type === 'object') {
			({type, group, instance} = type);
		}
		let query = {
			type,
			group,
			instance,
		};

		let index = bsearch.eq(this.records, query, compare);
		return index > -1 ? this.records[index] : null;

	}

	// ## findAllTI(type, instance)
	// Finds all entries with the given Type and Instance ID.
	findAllTI(type, instance) {
		let query = { type, instance, group: 0 };
		let index = bsearch.lt(this.records, query, compare);
		let out = [];
		let record;
		while (
			(record = this.records[++index]) &&
			record.type === type &&
			record.instance === instance
		) {
			out.push(record);
		}
		return out;
	}

	// ## family(id)
	// Checks if the a prop or building family exists with the given IID and 
	// if so returns the family array.
	family(id) {
		let arr = this.families.get(id);
		return arr || null;
	}

	// ## getProperty(exemplar, key)
	// This function accepts a parsed exemplar file and looks up the property 
	// with the given key. If the property doesn't exist, then tries to look 
	// it up in the parent cohort and so on all the way up.
	getProperty(exemplar, key) {
		let original = exemplar;
		let prop = exemplar.prop(key);
		while (!prop && exemplar.parent[0]) {
			let { parent } = exemplar;
			let entry = this.find(parent);
			if (!entry) {
				break;
			}
			exemplar = entry.read();
			prop = exemplar.prop(key);
		}
		return prop;
	}

	// ## getPropertyValue(exemplar, key)
	// Directly returns the value for the given property in the exemplar. If 
	// it doesn't exist, looks it up in the parent cohort.
	getPropertyValue(exemplar, key) {
		let prop = this.getProperty(exemplar, key);
		return prop ? prop.value : undefined;
	}

}
module.exports = FileIndex;

// # compare(a, b)
// The function that we use for sorting all files in our index. This 
// effectively creates an *index* on all the records so that we can use a 
// binary search algorithm for finding them. Given that the instance id (IID) 
// is what we'll use the most, this will be the main sorting key, followed by 
// type id (TID) and then by group id (GID).
function compare(a, b) {
	return a.instance - b.instance || a.type - b.type || a.group - b.group;
}

// # extRegex
const extRegex = /^(sc4desc)|(sc4lot)|(sc4model)|(dat)$/;

// # collect(dir, all)
// Recursively crawls the given directory and collects all files within it. 
// Note that we use the **sync** version of readdir here because the operation 
// is relatively inexpensive and we have to do it anyway.
function collect(dir, all) {
	all = all || [];
	let list = fs.readdirSync(dir);
	for (let file of list) {
		file = path.join(dir, file);
		let stat = fs.statSync(file);
		if (stat.isDirectory()) {
			collect(file, all);
		} else {
			all.push(file);
		}
	}
	return all;
}
