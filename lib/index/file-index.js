// # file-index.js
import { path, os } from 'sc4/utils';
import LRUCache from 'lru-cache';
import PQueue from 'p-queue';
import { DBPF, FileType } from 'sc4/core';
import { TGIIndex, hex } from 'sc4/utils';
import FileScanner from './file-scanner.js';
import WorkerPool from 'sc4/threading/worker-pool.js';
const Family = 0x27812870;

// Folder constants that we use as default. Might need to be made dynamical 
// though.
const plugins = path.resolve(os.homedir(), 'Documents/SimCity 4/Plugins');
const installation = 'C:\\GOG Games\\SimCity 4 Deluxe Edition';

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
			scan = [installation, plugins],
			core = false,
			mem = +os.totalmem,
		} = opts;
		let scanArray = ensureArray(scan);
		this.scan = core ? [installation, ...scanArray] : [...scanArray];

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

	// ## async build(opts)
	// Asyncrhonously builds up the file index in the same way that SimCity 4 
	// does. This means that the *load order* of the files is important! We also 
	// need to do some gymnastics to ensure the order is kept when parsing all 
	// the DBPF files in parallel because
	async build(opts = {}) {

		// Open a new worker pool because we'll be parsing all dbpf files in 
		// separate threads that report to the main thread.
		// TODO: We'll have to figure out how we can get this to work in a sea 
		// application! We should probably build multiple files with esbuild and 
		// add those as assets I guess.
		const pool = new WorkerPool(
			import.meta.resolve('./file-index-thread.js'),
		);

		// Loop all folders that we have to scan and then glob them one by one. 
		// TODO: this has to be parallelized and zipped into a async iterator 
		// that just reports whathever the filesystem reports back first! For 
		// now, we just do it sequentially - which is slower.
		const queue = [];
		const scanner = new FileScanner(this.scan);
		let tasks = [];
		for await (let { order, file } of scanner) {
			let task = pool.run({ name: 'index', file }).then(json => {

				// Deserialize the dbpf file again and push in our dbpf 
				// array so that we can sort our entries later on.
				const { dbpf: file, ...rest } = json;
				let dbpf = new DBPF({ file, parse: false, ...rest });
				queue.push({
					order,
					file: dbpf.file,
					dbpf,
				});

			});
			tasks.push(task);
		}
		await Promise.all(tasks);
		pool.close();

		// Now sort all dbpfs in load order. Note that in order to speed this 
		// up, we should probably already fix the order in the file scanner!
		queue.sort((a, b) => a.order - b.order || a.file < b.file ? -1 : 1);
		let sorted = [];
		for (let { dbpf } of queue) {
			for (let entry of dbpf.entries) {
				sorted.push(entry);
			}
		}

		// All index entries have been read in and are now in proper order in 
		// the array. We'll now flatten it so that the overriding logic is 
		// performed correctly. Note that we might add some logging here about 
		// what files we're throwing away.
		let map = {};
		for (let entry of sorted) {
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

function ensureArray(value) {
	return Array.isArray(value) ? value : [value];
}
