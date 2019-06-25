// # index.js
"use strict";
const fs = require('fs');
const path = require('path');
const os = require('os');
const bsearch = require('binary-search');
const DBPF = require('./dbpf');
const { Entry } = DBPF;
const {default:PQueue} = require('p-queue');

// Patch fs promises.
if (!fs.promises) {
	const util = require('util');
	fs.promises = {
		"readFile": util.promisify(fs.readFile)
	};
}

// # Index
// The index is a data structure that scans a list of dbpf files and builds up 
// an index of all files in it by their TGI's. This should mimmick how the 
// game scans the plugins folder as well. We obivously cannot keep everything 
// in memory so we'll keep pointers to where we can find each file **on the 
// disk**. Note: we should make use of node's async nature here so that we can 
// read in as much files as possible in parallel!
class Index {

	// ## constructor(opts)
	constructor(opts) {

		// Our array containing all our records. This array will be sorted by 
		// tgi.
		this.records = null;
		this.git = null;
		this.igt = null;

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
		let Q = new PQueue({"concurrency": max});
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
		this.git = this.records.map(x => x).sort(git);
		this.igt = this.records.map(x => x).sort(igt);
		this.records.sort(tgi);

	}

	// ## async addToIndex(file)
	// Asynchronously adds the given file to the index.
	async addToIndex(file) {

		// Read in the file.
		let buff = await fs.promises.readFile(file);
		const source = new Source(file);
		
		// Ensure that the file is a dbpf file, ignore otherwise.
		if (buff.toString('utf8', 0, 4) !== 'DBPF') return;

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
		query.type = type;
		query.group = group;
		query.instance = instance;

		let index = bsearch(this.records, query, tgi);
		if (index < 0) return null;
		return this.records[index];

	}

}
module.exports = Index;

// Object that we'll re-use to query so that we don't have to recreate it all 
// the time.
const query = {
	"type": 0,
	"group": 0,
	"instance": 0
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

		// Read from the file, but at the correct offset (and in a syncronous way).
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

// # extRegex
const extRegex = /^(sc4desc)|(sc4lot)|(sc4model)|(dat)$/;

// # tgi(a, b)
// TGI comparator that will sort by type, then group and then instance.
function tgi(a, b) {
	return a.type - b.type || a.group - b.group || a.instance - b.instance;
}

// # git(a, b)
// TGI comparator that will sort by group, then instance, then type.
function git(a, b) {
	return a.group - b.group || a.instance - b.instance || a.type - b.type;
}

// # igt(a, b)
// TGI comperator that will sort by instance, then group, then type.
function igt(a, b) {
	return a.instance - b.instance || a.group - b.group || a.type - b.type;
}

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