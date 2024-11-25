// # file-index.js
import { os } from 'sc4/utils';
import LRUCache from 'lru-cache';
import PQueue from 'p-queue';
import { DBPF, FileType } from 'sc4/core';
import { TGIIndex, hex } from 'sc4/utils';
import FileScanner from './file-scanner.js';
import WorkerPool from './worker-pool.js';
const Family = 0x27812870;

// The hash function we use for type, group and instances. It's fastest to just 
// use the identity function here, but for debugging purposes it can often be 
// useful to see the hex values.
const h = hex;

// # PluginIndex
// The plugin index is a data structure that scans a list of dbpf files and 
// builds up an index of all files in it by their TGI's. This should mimmick 
// how the game scans the plugins folder as well. We obivously cannot keep 
// everything in memory so we'll keep pointers to where we can find each file 
// **on the disk**. Note: we should make use of node's async nature here so 
// that we can read in as much files as possible in parallel!
export default class PluginIndex {

	scan = [];
	entries = [];
	families = Object.create(null);

	// ## constructor(opts)
	constructor(opts = {}) {

		// Normalize our options first.
		if (typeof opts === 'string') {
			opts = [opts];
		}
		if (Array.isArray(opts)) {
			opts = { scan: opts };
		}

		// Store some constructor options so we can read them in later again, 
		// most notably when building the index.
		const {
			scan = '**/*',
			core = true,
			installation = process.env.SC4_INSTALLATION,
			plugins = process.env.SC4_PLUGINS,
			mem = +os.totalmem,
		} = opts;
		this.options = {
			scan: [scan].flat(),
			core,
			installation,
			plugins,
		};

		// Set up the cache that we'll use to free up memory of DBPF files 
		// that are not read often.
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

	}

	// ## get length()
	get length() {
		return this.entries.length;
	}

	// ## async getFilesToScan()
	// Returns the array of files to scan, properly sorted in the order that we 
	// will read them in.
	async getFilesToScan(opts = {}) {

		// Get all files to scan. Note that we do this separately for the core 
		// files and the plugins because plugins *always* need to override core 
		// files.
		let coreFiles = [];
		let sourceFiles = [];
		let tasks = [];
		if (this.options.core && this.options.installation) {
			let task = new FileScanner(this.options.installation)
				.walk()
				.then(files => coreFiles = files);
			tasks.push(task);
		}

		// IMPORTANT! If the plugins folder is not specified - nor as an option 
		// to the build() function, nor to the constructor and neither in 
		// process.env.SC4_PLUGINS we **MUST NOT** default to the cwd as that 
		// might cause an enormous amount of files to be scanned when running 
		// inside the user's homedir or something. In that case, we simply don't 
		// scan any plugins!
		let { plugins } = opts;
		if (plugins) {
			let task = new FileScanner(this.options.scan, { cwd: plugins })
				.walk()
				.then(files => sourceFiles = files);
			tasks.push(task);
		}
		await Promise.all(tasks);

		// Sort both the core files and the plugins, but do it separately so 
		// that the plugins *always* override the core files.
		coreFiles.sort(compare);
		sourceFiles.sort(compare);
		return [...coreFiles, ...sourceFiles];

	}

	// ## async build(opts)
	// Asyncrhonously builds up the file index in the same way that SimCity 4 
	// does. This means that the *load order* of the files is important! We also 
	// need to do some gymnastics to ensure the order is kept when parsing all 
	// the DBPF files in parallel because
	async build(opts = {}) {

		// Open a new worker pool because we'll be parsing all dbpf files in 
		// separate threads that report to the main thread.
		const pool = new WorkerPool();
		const { plugins = this.options.plugins } = opts;
		const files = await this.getFilesToScan({ plugins });

		// Loop all files and then parse them one by one. Note that it's crucial 
		// here to maintain the sort order, so when a file is read in, we don't 
		// just put it in the queue, but we put it in the queue *at the right 
		// position*!
		const queue = new Array(files.length).fill();
		let tasks = [];
		for (let i = 0; i < files.length; i++) {
			let file = files[i];
			let task = pool.run({ name: 'index', file }).then(json => {
				const { dbpf: file, ...rest } = json;
				let dbpf = new DBPF({ file, parse: false, ...rest });
				queue[i] = dbpf;
			});
			tasks.push(task);
		}
		await Promise.all(tasks);
		pool.close();

		// Reverse the array so that files that were seen last are the ones that 
		// are kept. This is faster than using "unshift" apparently.
		queue.reverse();
		let unique = [];
		let seen = new Set();
		for (let dbpf of queue) {
			for (let entry of dbpf) {
				let id = hash(entry);
				if (!seen.has(id)) unique.push(entry);
			}
		}
		unique.reverse();

		// Get all entries again in a flat array and then create our index from 
		// it. **IMPORTANT**! We can't create the index with new 
		// TGIIndex(...values) because there might be a *ton* of entries, 
		// causing a stack overflow - JS can only handle that many function 
		// arguments!
		let { length } = unique;
		let entries = this.entries = new TGIIndex(length);
		for (let i = 0; i < length; i++) {
			entries[i] = unique[i];
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
				try {
					let exemplar = await entry.readAsync();
					let families = this.getPropertyValue(exemplar, Family);
					if (!Array.isArray(families)) families = [families];
					for (let family of families) {
						if (family) {
							let key = h(family);
							this.families[key] ??= [];
							this.families[key].push(entry);
						}
					}
				} catch (e) {

					// Some exemplars fail to parse apparently, ignore this for 
					// now.
					console.warn(`Failed to parse exemplar ${entry.id}: ${e.message}`);

				}
			});
		}
		await queue.onIdle();
	}

	// ## load(cache)
	// Instead of building up an index, we can also read in a cache index. 
	// That's useful if we're often running a script on a large plugins folder 
	// where we're sure the folder doesn't change. We can gain a lot of precious 
	// time by reading in a cached version in this case!
	async load(cache) {

		// Create the new tgi collection.
		const { dbpfs, files, families, entries: json } = cache;
		this.entries = new TGIIndex(json.length);
		for (let i = 0; i < dbpfs.length; i++) {
			let file = files[i];
			let pointers = dbpfs[i];
			let dbpf = new DBPF({
				file,
				entries: pointers.map(ptr => json[ptr]),
				parse: false,
			});
			for (let i = 0; i < dbpf.length; i++) {
				this.entries[pointers[i]] = dbpf.entries[i];
			}
		}

		// if the index was cached as well, load it, otherwise we have to 
		// rebuild it manually - which might be done behind the scenes later on.
		if (cache.index) {
			this.entries.load(cache.index);
		} else {
			this.entries.build();
		}

		// At last rebuild the families as well.
		this.families = Object.create(null);
		for (let key of Object.keys(families)) {
			let pointers = families[key];
			this.families[key] = pointers.map(ptr => this.entries[ptr]);
		}
		return this;

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

	// ## getScalarPropertyValue(exemplar, key)
	// Same as getPropertyValue, but unwraps the value if it is an array of a 
	// single value.
	getScalarPropertyValue(exemplar, key) {
		let value = this.getPropertyValue(exemplar, key);
		return Array.isArray(value) ? value[0] : value;
	}

	// ## toJSON()
	toJSON() {

		// First thing we'll do is getting all our entries and getting the dbpf 
		// files from it.
		let dbpfSet = new Set();
		let entryToKey = new Map();
		let entries = [];
		let i = 0;
		for (let entry of this.entries) {
			let id = i++;
			entryToKey.set(entry, id);
			dbpfSet.add(entry.dbpf);
			entries.push(entry.toJSON());
		}

		// Fill up the files array containing all file paths, along with the 
		// dbpfs array, that contains sub-arrays with pointers to the entries. 
		// That way our json gzips nicely.
		let files = [];
		let dbpfs = [];
		for (let dbpf of dbpfSet) {
			files.push(dbpf.file);
			let pointers = [];
			for (let entry of dbpf.entries) {
				let ptr = entryToKey.get(entry);
				if (ptr === undefined) continue;
				pointers.push(ptr);
			}
			dbpfs.push(pointers);
		}

		// We'll also serialize the index on all our entries because that one is 
		// expensive to build up as well.
		let index = this.entries.index.toJSON();

		// Serialize our built up families as well, as this one also takes a lot 
		// of time to read.
		let families = {};
		for (let id of Object.keys(this.families)) {
			let family = this.families[id];
			let pointers = [];
			for (let entry of family) {
				let ptr = entryToKey.get(entry);
				if (ptr !== undefined) {
					pointers.push(ptr);
				}
			}
			families[id] = pointers;
		}

		// Return at last.
		return {
			files,
			dbpfs,
			entries,
			index,
			families,
		};

	}

	// ## *[Symbol.iterator]() {
	*[Symbol.iterator]() {
		yield* this.entries;
	}

}

// # hash(entry)
// Calculates a unique hash for the given entry. This function should be 
// optimized for maximum speed.
function hash(entry) {
	return `${entry.type},${entry.group},${entry.instance}`;
}

// # compare(a, b)
// The comparator function that determines the load order of the files.
function compare(a, b) {
	return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
}
