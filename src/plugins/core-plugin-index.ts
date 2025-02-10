// # core-plugin-index.ts
import { LRUCache } from 'lru-cache';
import PQueue from 'p-queue';
import {
    FileType,
	DBPF,
	Entry,
	type EntryJSON,
	type Exemplar,
	ExemplarProperty,
	type ExemplarPropertyKey as Key,
	TGI,
    type DecodedFileTypeId,
    type EntryFromType,
} from 'sc4/core';
import type { TGIArray, TGIQuery, uint32 } from 'sc4/types';
import {
	TGIIndex,
	type TGIFindParameters,
	type TGIIndexJSON,
} from 'sc4/utils';
import { SmartBuffer } from 'smart-arraybuffer';
const Family = ExemplarProperty.BuildingpropFamily;

type PluginIndexOptions = {
	scan?: string | string[];
	core?: boolean;
	installation?: string;
	plugins?: string;
	mem?: number;
	threads?: number;
};

type CacheJSON = {
	files: string[];
	dbpfs: number[][];
	entries: EntryJSON[];
	index: TGIIndexJSON;
	families: { [id: string]: [number, number, number][] };
};

// The hash function we use for type, group and instances. It's fastest to just 
// use the identity function here, but for debugging purposes it can often be 
// useful to see the hex values.
type ExemplarEntry = Entry<Exemplar>;

// # CorePluginIndex
// Contains the core functionality for a plugin index that is shared between 
// Node and the browser.
// A plugin index is a data structure that scans a list of dbpf files and builds
// up an index of all the files in it by their TGI's.
export default abstract class CorePluginIndex {
	scan: string[] = [];
	dbpfs: DBPF[] = [];
	entries: TGIIndex<Entry> = new TGIIndex();
	families = new Map<uint32, TGI[]>();
	cache: LRUCache<string, Entry>;
	constructor(opts: PluginIndexOptions) {

		// By default we will look for .dat and .sc4* files. Nothing else need 
		// to be handled.
		const { scan = '**/*.{dat,sc4model,sc4desc,sc4lot}' } = opts;
		this.scan = [scan].flat();

		// Set up the cache that we'll use to free up memory of DBPF files 
		// that are not read often.
		const { mem = 4*1024**3 } = opts;
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

	// ## buildFamilies()
	// Builds up the index of all building & prop families by reading in all 
	// exemplars.
	async buildFamilies(opts: { concurrency?: number } = {}) {
		let { concurrency = 4096 } = opts;
		let exemplars = this.findAll({ type: FileType.Exemplar });
		let queue = new PQueue({ concurrency });
		let tasks: Promise<any>[] = new Array(exemplars.length);
		let i = 0;
		for (let entry of exemplars) {

			// If the entry has group id 0xa8fbd372, then we can tell it's a lot 
			// configurations exemplar, so no need to parse it in that case.
			if (entry.group === 0xa8fbd372) continue;
			let task = queue.add(async () => {
				try {
					let exemplar = await entry.readAsync();
					let families = await this.getPropertyValueAsync(exemplar, Family);
					if (!families) return;
					for (let family of families) {
						if (family) {
							const arr = this.families.get(family);
							if (!arr) {
								this.families.set(family, [entry.tgi]);
							} else {
								arr.push(entry.tgi);
							}
						}
					}
				} catch (e) {

					// Some exemplars fail to parse apparently, ignore this for 
					// now.
					console.warn(`Failed to parse exemplar ${entry.id}: ${e.message}`);
					throw e;

				}
			});
			tasks[i++] = task;
		}
		tasks.length = i;
		await Promise.all(tasks);

		// We're not done yet. If a prop pack adds props to a Maxis family, then 
		// multiple of the *same* tgi might be present in the family array. We 
		// have to avoid this, so we need to filter the tgi's again to be unique.
		for (let [family, tgis] of this.families) {
			let had = new Set();
			let filtered = tgis.filter(tgi => {
				let id = hash(tgi);
				if (!had.has(id)) {
					had.add(id);
					return true;
				} else {
					return false;
				}
			});
			this.families.set(family, filtered);
		}

	}

	// ## load(buffer)
	// Instead of building up an index, we can also read in a cache index. 
	// That's useful if we're often running a script on a large plugins folder 
	// where we're sure the folder doesn't change. We can gain a lot of precious 
	// time by reading in a cached version in this case!
	async load(buffer: Uint8Array) {

		// First we'll read in all the dbpfs.
		const rs = SmartBuffer.fromBuffer(buffer);
		this.dbpfs = new Array(rs.readUInt32LE());
		for (let i = 0; i < this.dbpfs.length; i++) {
			const file = rs.readStringNT();
			this.dbpfs[i] = new DBPF({ file, parse: false });
		}

		// Next we'll restore all the entries.
		this.entries = new TGIIndex(rs.readUInt32LE());
		for (let i = 0; i < this.entries.length; i++) {
			const type = rs.readUInt32LE();
			const group = rs.readUInt32LE();
			const instance = rs.readUInt32LE();
			const offset = rs.readUInt32LE();
			const size = rs.readUInt32LE();
			const ptr = rs.readUInt32LE();
			const dbpf = this.dbpfs[ptr];
			const entry = this.entries[i] = new Entry({
				tgi: [type, group, instance],
				offset,
				size,
			});
			dbpf.entries.push(entry);
		}

		// Next we'll restore the index.
		const size = rs.readUInt32LE(rs.readOffset);
		const indexBuffer = rs.readBuffer(size);
		this.entries.load(indexBuffer);

		// console.log(buffer);
		// Create the new tgi collection.
		// const { dbpfs, files, families, entries: json } = cache;
		// this.entries = new TGIIndex(json.length);
		// for (let i = 0; i < dbpfs.length; i++) {
		// 	let file = files[i];
		// 	let pointers = dbpfs[i];
		// 	let dbpf = new DBPF({
		// 		file,
		// 		entries: pointers.map(ptr => json[ptr]),
		// 		parse: false,
		// 	});
		// 	for (let i = 0; i < dbpf.length; i++) {
		// 		this.entries[pointers[i]] = dbpf.entries[i];
		// 	}
		// }

		// // if the index was cached as well, load it, otherwise we have to 
		// // rebuild it manually - which might be done behind the scenes later on.
		// if (cache.index) {
		// 	this.entries.load(cache.index);
		// } else {
		// 	this.entries.build();
		// }

		// // At last rebuild the families as well.
		// this.families = Object.create(null);
		// for (let key of Object.keys(families)) {
		// 	let pointers = families[key];
		// 	this.families[key] = pointers.map(ptr => new TGI(...ptr));
		// }
		// return this;

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
		return this.families.get(family) ?? [];
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
			getAsync: async <K extends Key = Key>(key: K) => {
				return await this.getPropertyValueAsync(exemplar, key);
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

	// ## getPropertyAsync()
	// Same as .getProperty(), but in an async way, because we might need to 
	// look up a parent cohort.
	async getPropertyAsync<K extends Key = Key>(exemplar: Exemplar, key: K) {
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
			exemplar = await entry.readAsync();
			if (typeof exemplar.prop !== 'function') {
				console.log('Something wrong', entry.dbpf.file, entry);
				console.log('-'.repeat(100));
			}
			prop = exemplar.prop(key);
		}
		return prop;
	}

	// ## getPropertyValueAsync()
	// Same as getPropertyValue(), but in an async way, which is required in the
	// browser, but also speeds up indexing the building families sometimes.
	async getPropertyValueAsync<K extends Key = Key>(
		exemplar: Exemplar,
		key: K,
	) {
		let prop = await this.getPropertyAsync(exemplar, key);
		return prop ? prop.getSafeValue() : undefined;
	}

	// ## toBuffer()
	toBuffer() {

		// The first thing we'll do is serialize the file paths for every dbpf.
		const { dbpfs } = this;
		const dbpfToIndex = new Map<DBPF, number>();
		const ws = new SmartBuffer();
		ws.writeUInt32LE(dbpfs.length);
		for (let i = 0; i < dbpfs.length; i++) {
			const dbpf = dbpfs[i];
			dbpfToIndex.set(dbpf, i);
			ws.writeStringNT(dbpf.file!);
		}

		// Next we'll serialize all the entries. This means we serialize the 
		// TGI, followed by the offset and size, meaning that same structure as 
		// a dbpf index table, and then followed by a pointer to the dbpf file 
		// it's part of.
		const { entries } = this;
		ws.writeUInt32LE(entries.length);
		for (let entry of entries) {
			const { tgi, offset, size } = entry;
			ws.writeUInt32LE(tgi.type);
			ws.writeUInt32LE(tgi.group);
			ws.writeUInt32LE(tgi.instance);
			ws.writeUInt32LE(offset);
			ws.writeUInt32LE(size);
			const index = dbpfToIndex.get(entry.dbpf)!;
			ws.writeUInt32LE(index);
		}

		// Next we serialize the actual TGI index. This is relatively easy now, 
		// because we can simply re-use the underlying Uint32Arrays. Note that 
		// this means it depends on the system endianness.
		ws.writeBuffer(entries.index.serialize());

		// At last we serialize the families as well.
		const { families } = this;
		ws.writeInt32LE(families.size);
		for (let [family, tgis] of this.families) {
			ws.writeUInt32LE(family);
			ws.writeInt32LE(tgis.length);
			for (let tgi of tgis) {
				ws.writeUInt32LE(tgi.type);
				ws.writeUInt32LE(tgi.group);
				ws.writeUInt32LE(tgi.instance);
			}
		}
		return ws.toBuffer();

	}

	// ## *[Symbol.iterator]() {
	*[Symbol.iterator]() {
		yield* this.entries;
	}

}

// # hash(tgi)
function hash(tgi: TGI): bigint {
	return tgi.toBigInt();
}
