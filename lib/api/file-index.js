// # file-index.js
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import LRUCache from 'lru-cache';
import PQueue from 'p-queue';
import { DBPF, FileType } from 'sc4/core';
import { TGIIndex, hex } from 'sc4/utils';
const Family = 0x27812870;

// The hash function we use for type, group and instances. It's fastest to just 
// use the identity function here, but for debugging purposes it can often be 
// useful to see the hex values.
const h = hex;

// # FileIndex
// The file index is a data structure that scans a list of dbpf files and 
// builds up an index of all files in it by their TGI's. This should mimmick 
// how the game scans the plugins folder as well. We obivously cannot keep 
// everything in memory so we'll keep pointers to where we can find each file 
// **on the disk**. Note: we should make use of node's async nature here so 
// that we can read in as much files as possible in parallel!
export default class FileIndex {

	// ## constructor(opts)
	constructor(opts = {}) {

		// Set up the cache that we'll use to free up memory of DBPF files 
		// that are not read often.
		let { mem = Number(os.totalmem) } = opts;
		this.cache = new LRUCache({
			max: 0.5*mem,
			length(n, entry) {
				if (!entry.buffer) return 0;
				return entry.buffer.byteLength;
			},
			dispose(entry, n) {
				entry.free();
			},
		});

		// The array containing all DBPF index entries. These represent the 
		// unread files.
		this.entries = [];
		Object.defineProperty(this, 'tgi', {
			writable: true,
			enumerable: false,
			value: null,
		});

		// A map that contains references to all building & prop families. 
		// Note that we cannot use a separate data structure for this because 
		// the order in which files get loaded is important here!
		this.families = Object.create(null);

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
			opts = {
				dirs: [plugins],
				...opts,
			};
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
	// Asyncrhonously builds up the file index in the same way that SimCity 4 
	// does. This means that the *load order* of the files is important! We also 
	// need to do some gymnastics to ensure the order is kept when parsing all 
	// the DBPF files in parallel because
	async build(opts = {}) {

		// Initialize the array that will contain all parsed index entries from 
		// each DBPF file. By keeping track of the index of the file in the 
		// array, we ensure that all index entries are kept in order, so that we 
		// can later perform the correct overriding.
		const { concurrency = 512 } = opts;
		const { files } = this;
		let runner = new PQueue({ concurrency });
		let queue = Array(files.length);

		// Loop all files and start reading them in.
		for (let i = 0; i < files.length; i++) {
			runner.add(async () => {
				let file = files[i];
				let dbpf = new DBPF({ file, parse: false });
				try {
					await dbpf.parseAsync();
				} catch (e) {
					console.log(file);
					throw e;
				}
				queue[i] = [...dbpf.entries];
			});
		}
		await runner.onIdle();

		// All index entries have been read in and are now in proper order in 
		// the array. We'll now flatten it so that the overriding logic is 
		// performed correctly. Note that we might add some logging here about 
		// what files we're throwing away.
		let map = {};
		for (let entry of queue.flat()) {
			map[entry.id] = entry;
		}

		// Get all entries again in a flat array and then create our index from 
		// it. **IMPORTANT**! We can't create the index with new 
		// TGIIndex(...values) because there might be a *ton* of entries, 
		// causing a stack overflow - JS can only handle that many function 
		// arguments!
		let flat = Object.values(map);
		let entries = this.entries = new TGIIndex(flat.length);
		for (let i = 0; i < entries.length; i++) {
			entries[i] = flat[i];
		}
		entries.build();

	}

	// ## buildFamilies()
	// Builds up the index of all building & prop families by reading in all 
	// exemplars.
	async buildFamilies(opts = {}) {
		let { concurrency = 512 } = opts;
		let exemplars = this.findAll({ type: FileType.Exemplar });
		let queue = new PQueue({ concurrency });
		for (let entry of exemplars) {
			queue.add(async () => {
				let exemplar = await entry.read();
				let families = this.getPropertyValue(exemplar, Family);
				if (!Array.isArray(families)) families = [families];
				for (let family of families) {
					if (family) {
						let key = h(family);
						this.families[key] ??= [];
						this.families[key].push(entry);
					}
				}
			});
		}
		await queue.onIdle();
	}

	// ## touch(entry)
	// This method puts the given entry on top of the LRU cache, which means 
	// that they will be registered as "last used" and hence are less likely to 
	// get kicked out of memory (once loaded of course).
	touch(entry) {
		if (entry) {
			this.cache.set(entry);
		}
		return entry;
	}

	// ## find(type, group, instance)
	// Finds the record identified by the given tgi.
	find(type, group, instance) {
		return this.entries.find(type, group, instance);
	}

	// ## findAll(query)
	// Finds all records that satisfy the given query.
	findAll(query) {
		return this.entries.findAll(query);
	}

	// ## family(id)
	// Checks if the a prop or building family exists with the given IID and 
	// if so returns the family array.
	family(id) {
		let arr = this.families[h(id)];
		return arr || null;
	}

	// ## getProperty(exemplar, key)
	// This function accepts a parsed exemplar file and looks up the property 
	// with the given key. If the property doesn't exist, then tries to look 
	// it up in the parent cohort and so on all the way up.
	getProperty(exemplar, key) {
		let prop = exemplar.prop(key);
		while (!prop && exemplar.parent[0]) {
			let { parent } = exemplar;
			let entry = this.find(parent);
			if (!entry) {
				break;
			};

			// Apparently Exemplar files can specify non-Cohort files as their 
			// parent cohorts. This happens for example with the NAM. We need to 
			// handle this gracefully.
			if (!(
				entry.type === FileType.Exemplar ||
				entry.type === FileType.Cohort
			)) {
				break;
			}
			exemplar = entry.read();
			if (typeof exemplar.prop !== 'function') {
				console.log('Something wrong', entry.dbpf.file, entry);
				console.log('-'.repeat(100));
			}
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

	// ## *[Symbol.iterator]() {
	*[Symbol.iterator]() {
		yield* this.entries;
	}

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
