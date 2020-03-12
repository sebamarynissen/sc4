// # file-index.js
"use strict";
const fs = require('fs');
const path = require('path');
const os = require('os');
const bsearch = require('binary-search-bounds');
const DBPF = require('./dbpf');
const { Entry } = DBPF;
const {default:PQueue} = require('p-queue');

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
	constructor(opts) {

		// Our array containing all our records. This array will be sorted by 
		// tgi.
		this.records = null;

		// No options specified? Use the default plugins directory. Note that 
		// we should look for the SimCity_1.dat core files as well of course.
		if (!opts) {
			let plugins = path.join(
				process.env.HOMEPATH,
				'Documents/SimCity 4/Plugins',
			);
			opts = {
				dirs: [plugins],
			};
		}

		// If the options are simply given as a string, consider it to be a 
		// directory.
		if (typeof opts === 'string') {
			opts = { dirs: [opts] };
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

	}

	// ## async addToIndex(file)
	// Asynchronously adds the given file to the index. Note that this is not 
	// meant for external use as this doesn't sort the records!
	async addToIndex(file) {

		// Read in the file.
		let buff = await fs.promises.readFile(file);
		const source = new Source(file);
		
		// Ensure that the file is a dbpf file, ignore otherwise.
		if (buff.toString('utf8', 0, 4) !== 'DBPF') {
			return;
		}

		// Parse.
		let dbpf = new DBPF(buff);
		for (let entry of dbpf.entries) {
			let record = new Record(entry);
			record.source = source;
			this.records.push(record);
		}

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

}
module.exports = FileIndex;

// Object that we'll re-use to query so that we don't have to recreate it all 
// the time.
const query = {
	type: 0,
	group: 0,
	instance: 0
};

// # Record
// Represents an record in the index.
class Record extends Entry {

	// ## constructor(entry)
	// Creates the record from the underlying dbpf entry. The difference here 
	// is that we no longer store the raw buffer because we don't want to keep 
	// everything in memory. We'll provide functionality to read the file by 
	// ourselves.
	constructor(entry) {
		super();
		this.type = entry.type;
		this.group = entry.group;
		this.instance = entry.instance;
		this.fileSize = entry.fileSize;
		this.compressedSize = entry.compressedSize;
		this.offset = entry.offset;
		this.compressed = entry.compressed;

		// Additionally store a reference to the source file where we can find 
		// the entry as well.
		this.source = null;

	}

	// ## read()
	// Overrides the DBPF's read method because we no longer have a raw buffer 
	// set. We need to read that one in first.
	read() {

		// Entry already read? Don't read it again.
		if (this.file) return this.file;
		if (this.raw) return this.raw;

		// Read from the file, but at the correct offset (and in a synchronous 
		// way).
		let file = String(this.source);
		let fd = fs.openSync(file, 'r');
		let buff = Buffer.allocUnsafe(this.compressedSize);
		fs.readSync(fd, buff, 0, buff.byteLength, this.offset);
		fs.closeSync(fd);
		this.raw = buff;

		// Call the super method.
		return super.read();

	}

}

// # Source
// Represents a source file. We use this so that we don't have to include the 
// long filename everywhere. Saves on memory because we can work with 
// pointers, yeah well references.
class Source {
	constructor(file) {
		this.file = file;
	}
	toString() {
		return this.file;
	}
}

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