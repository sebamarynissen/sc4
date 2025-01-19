// # file-index.js
import { os } from 'sc4/utils';
import { LRUCache } from 'lru-cache';
import PQueue from 'p-queue';
import { DBPF, Exemplar, ExemplarProperty, FileType, TGI } from 'sc4/core';
import { TGIIndex, hex } from 'sc4/utils';
import FileScanner from './file-scanner.js';
import WorkerPool from './worker-pool.js';
import type {
	DBPFJSON,
	Entry,
	EntryFromType,
	EntryJSON,
	DecodedFileTypeId,
	ExemplarPropertyKey as Key,
} from 'sc4/core';
import type { TGIArray, TGIQuery, uint32 } from 'sc4/types';
import type { TGIFindParameters, TGIIndexJSON } from 'sc4/utils';
const Family = ExemplarProperty.BuildingpropFamily;

// The amount of files we need to scan before we're going to use multithreading.
const MULTITHREAD_LIMIT = 1_000;

// The hash function we use for type, group and instances. It's fastest to just 
// use the identity function here, but for debugging purposes it can often be 
// useful to see the hex values.
const h = hex;

type folder = string;
type PluginIndexOptions = {
	scan?: string | string[];
	core?: boolean;
	installation?: folder;
	plugins?: folder;
	mem?: number;
	threads?: number;
};

type GeneralBuildOptions = {
	concurrency?: number;
};

type BuildOptions = GeneralBuildOptions & {
	plugins?: string;
};

type CacheJSON = {
	files: string[];
	dbpfs: number[][];
	entries: EntryJSON[];
	index: TGIIndexJSON;
	families: { [id: string]: [number, number, number][] };
};

type ExemplarEntry = Entry<Exemplar>;
type FamilyIndex = {
	[id: string]: TGI[];
};

// # PluginIndex
// The plugin index is a data structure that scans a list of dbpf files and 
// builds up an index of all files in it by their TGI's. This should mimmick 
// how the game scans the plugins folder as well. We obivously cannot keep 
// everything in memory so we'll keep pointers to where we can find each file 
// **on the disk**. Note: we should make use of node's async nature here so 
// that we can read in as much files as possible in parallel!
export default class PluginIndex {
	scan: string[] = [];
	entries: TGIIndex<Entry> = new TGIIndex();
	families: FamilyIndex = Object.create(null);
	cache: LRUCache<string, Entry>;
	options: {
		scan: string[];
		core: boolean;
		installation: folder | undefined;
		plugins: folder | undefined;
		threads: number | undefined;
	};

	// ## constructor(opts)
	constructor(opts: PluginIndexOptions | string | string[] = {}) {

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
			mem = +os!.totalmem,
			threads,
		} = opts;
		this.options = {
			scan: [scan].flat(),
			core,
			installation,
			plugins,
			threads,
		};

		// Set up the cache that we'll use to free up memory of DBPF files 
		// that are not read often.
		this.cache = new LRUCache({
			maxSize: 0.5*mem,
			sizeCalculation(entry) {
				if (!entry.buffer) return 0;
				return entry.buffer.byteLength;
			},
			dispose(entry) {
				entry.free();
			},
		});

	}

	// ## get length()
	get length(): number {
		return this.entries?.length ?? 0;
	}

	// ## async getFilesToScan()
	// Returns the array of files to scan, properly sorted in the order that we 
	// will read them in.
	async getFilesToScan(opts: BuildOptions = {}) {

		// Get all files to scan. Note that we do this separately for the core 
		// files and the plugins because plugins *always* need to override core 
		// files.
		let coreFiles: string[] = [];
		let sourceFiles: string[] = [];
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
	async build(opts: BuildOptions = {}) {

		// Open a new worker pool because we'll be parsing all dbpf files in 
		// separate threads that report to the main thread. However, note that 
		// actual multithreading is only useful when we have a ton of files. 
		// We're already reading in the files itself asynchronously, so even 
		// without multithreading we make use of multiple cores. Starting the 
		// threads has an overhead, so we'll only use multithreading with a very 
		// large amount of files.
		const { plugins = this.options.plugins } = opts;
		const files = await this.getFilesToScan({ plugins });
		let {
			threads = (files.length > MULTITHREAD_LIMIT ? undefined : 0),
		} = this.options;
		const pool = new WorkerPool({ n: threads });

		// Loop all files and then parse them one by one. Note that it's crucial 
		// here to maintain the sort order, so when a file is read in, we don't 
		// just put it in the queue, but we put it in the queue *at the right 
		// position*!
		const queue: Entry[][] = new Array(files.length).fill(undefined);
		let tasks: Promise<DBPF>[] = [];
		for (let i = 0; i < files.length; i++) {
			let file = files[i];
			let task = pool.run({ name: 'index', file }).then((json: DBPFJSON) => {
				let dbpf = new DBPF({ ...json, parse: false });
				queue[i] = [...dbpf];
			}) as Promise<DBPF>;
			tasks.push(task);
		}
		await Promise.all(tasks);
		pool.close();

		// Get all entries again in a flat array and then create our index from 
		// it. **IMPORTANT**! We can't create the index with new 
		// TGIIndex(...values) because there might be a *ton* of entries, 
		// causing a stack overflow - JS can only handle that many function 
		// arguments!
		let flat = queue.flat();
		let entries = this.entries = new TGIIndex(flat.length);
		for (let i = 0; i < flat.length; i++) {
			entries[i] = flat[i];
		}
		entries.build();

	}

	// ## buildFamilies()
	// Builds up the index of all building & prop families by reading in all 
	// exemplars.
	async buildFamilies(opts: GeneralBuildOptions = {}) {
		let { concurrency = 512 } = opts;
		let exemplars = this.findAll({ type: FileType.Exemplar });
		let queue = new PQueue({ concurrency });
		for (let entry of exemplars) {
			queue.add(async () => {
				try {
					let exemplar = await entry.readAsync();
					let families = this.getPropertyValue(exemplar, Family);
					if (!families) return;
					for (let family of families) {
						if (family) {
							let key = h(family as number);
							this.families[key] ??= [];
							this.families[key].push(new TGI(entry.tgi));
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

		// We're not done yet. If a prop pack adds props to a Maxis family, then 
		// multiple of the *same* tgi might be present in the family array. We 
		// have to avoid this, so we need to filter the tgi's again to be unique.
		for (let key of Object.keys(this.families)) {
			let family = this.families[key];
			let had = new Set();
			this.families[key] = family.filter(tgi => {
				let id = hash(tgi);
				if (!had.has(id)) {
					had.add(id);
					return true;
				} else {
					return false;
				}
			});
		}

	}

	// ## load(cache)
	// Instead of building up an index, we can also read in a cache index. 
	// That's useful if we're often running a script on a large plugins folder 
	// where we're sure the folder doesn't change. We can gain a lot of precious 
	// time by reading in a cached version in this case!
	async load(cache: CacheJSON) {

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
			this.families[key] = pointers.map(ptr => new TGI(...ptr));
		}
		return this;

	}

	// ## touch(entry)
	// This method puts the given entry on top of the LRU cache, which means 
	// that they will be registered as "last used" and hence are less likely to 
	// get kicked out of memory (once loaded of course).
	touch(entry: Entry) {
		if (entry) {
			this.cache.set(entry.id, entry);
		}
		return entry;
	}

	// ## find(type, group, instance)
	// Finds the record identified by the given tgi.
	find<T extends DecodedFileTypeId>(query: TGIQuery<T>): EntryFromType<T> | undefined;
	find<T extends DecodedFileTypeId>(query: TGIArray<T>): EntryFromType<T> | undefined;
	find<T extends DecodedFileTypeId>(type: T, group: uint32, instance: uint32): EntryFromType<T> | undefined;
	find(...params: TGIFindParameters<Entry>): Entry | undefined;
	find(...args: TGIFindParameters<Entry>) {
		return this.entries.find(...args as Parameters<TGIIndex<Entry>['find']>);
	}

	// ## findAll(query)
	// Finds all records that satisfy the given query.
	findAll<T extends DecodedFileTypeId>(query: TGIQuery<T>): EntryFromType<T>[];
	findAll<T extends DecodedFileTypeId>(query: TGIArray<T>): EntryFromType<T>[];
	findAll<T extends DecodedFileTypeId>(type: T, group: uint32, instance: uint32): EntryFromType<T>[];
	findAll(...params: TGIFindParameters<Entry>): Entry[]
	findAll(...args: TGIFindParameters<Entry>): Entry[] {
		return this.entries.findAll(...args as Parameters<TGIIndex<Entry>['findAll']>);
	}

	// ## getFamilyTGIs(family)
	getFamilyTGIs(family: uint32) {
		return this.families[h(family)] ?? [];
	}

	// ## family(id)
	// Checks if the a prop or building family exists with the given IID and 
	// if so returns the family array.
	family(family: uint32): ExemplarEntry[] | null {
		let arr = this.getFamilyTGIs(family).map(tgi => this.find(tgi)!) as ExemplarEntry[];
		return arr.length > 0 ? arr : null;
	}

	// ## getHierarchicExemplar(exemplar)
	// Creates a small wrapper around the given exemplar that looks up values in 
	// the exemplar's parent cohort if they are not present in the exemplar 
	// itself.
	getHierarchicExemplar(exemplar: Exemplar) {
		return {
			get: <K extends Key = Key>(key: K) => {
				return this.getPropertyValue(exemplar, key);
			},
		};
	}

	// ## getProperty(exemplar, key)
	// This function accepts a parsed exemplar file and looks up the property 
	// with the given key. If the property doesn't exist, then tries to look 
	// it up in the parent cohort and so on all the way up.
	getProperty<K extends Key = Key>(exemplar: Exemplar, key: K) {
		let prop = exemplar.prop(key);
		while (!prop && exemplar.parent.type) {
			let { parent } = exemplar;
			let entry = this.find(parent);
			if (!entry) {
				break;
			};

			// Apparently Exemplar files can specify non-Cohort files as their 
			// parent cohorts. This happens for example with the NAM. We need to 
			// handle this gracefully.
			if (!(
				entry.isType(FileType.Exemplar) ||
				entry.isType(FileType.Cohort)
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
	getPropertyValue<K extends Key = Key>(exemplar: Exemplar, key: K) {
		let prop = this.getProperty(exemplar, key);
		return prop ? prop.getSafeValue() : undefined;
	}

	// ## toJSON()
	toJSON(): CacheJSON {

		// First thing we'll do is getting all our entries and getting the dbpf 
		// files from it.
		let dbpfSet: Set<DBPF> = new Set();
		let entryToKey: Map<Entry, number> = new Map();
		let entries: EntryJSON[] = [];
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
		let files: string[] = [];
		let dbpfs: number[][] = [];
		for (let dbpf of dbpfSet) {
			files.push(dbpf.file!);
			let pointers: number[] = [];
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
		let families: { [id: string]: TGIArray[] } = {};
		for (let id of Object.keys(this.families)) {
			let family = this.families[id];
			let pointers = [];
			for (let tgi of family) {
				pointers.push([...tgi] as TGIArray);
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

// # compare(a, b)
// The comparator function that determines the load order of the files.
function compare(a: string, b: string) {
	return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
}

// # hash(tgi)
function hash(tgi: TGI) {
	return `${tgi.type},${tgi.group},${tgi.instance}`;
}
