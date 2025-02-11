// # core-plugin-index.ts
import { LRUCache } from 'lru-cache';
import {
    FileType,
	DBPF,
	Entry,
	type Exemplar,
	type ExemplarPropertyKey as Key,
	TGI,
    type DecodedFileTypeId,
    type EntryFromType,
} from 'sc4/core';
import type { TGIArray, TGIQuery, uint32 } from 'sc4/types';
import {
	TGIIndex,
	type TGIFindParameters,
} from 'sc4/utils';
import { SmartBuffer } from 'smart-arraybuffer';
import buildFamilyIndex from './build-family-index.js';
import type { Glob } from './directory-scan-operation.js';
import DirectoryScanOperation from './directory-scan-operation.js';

export type PluginIndexOptions = {
	scan?: string | string[];
	core?: boolean;
	mem?: number;
	threads?: number;
};

type BuildOptions<T extends CorePluginIndex> = {
	installation?: T['installation'];
	plugins?: T['plugins'];
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
	core: boolean = true;
	abstract installation?: unknown;
	abstract plugins?: unknown;
	constructor(opts: PluginIndexOptions) {

		// By default we will look for .dat and .sc4* files. Nothing else need 
		// to be handled.
		const {
			scan = '**/*.{dat,sc4model,sc4desc,sc4lot}',
			core = true,
			mem = 4*1024**3,
		} = opts;
		this.scan = [scan].flat();
		this.core = core;

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

	// ## createGlob()
	// This method must be implemented when extending a core plugin index. It 
	// should return an async iterable that traverses all dbpfs in a directory 
	// and yields the proper dbpf constructor options - a buffer, a file path or 
	// a File object.
	abstract createGlob(pattern: string | string[], cwd: unknown): Glob;

	// ## async build(opts)
	// Asynchronously builds up the file index in the same way that SimCity 4 
	// does. This means that the *load order* of the files is important!
	async build(opts: BuildOptions<typeof this> = {}) {
		const all = [];
		const ops = [];

		// If the installation folder is specified, read it in.
		const {
			plugins = this.plugins,
			installation = this.installation,
		} = opts;
		if (this.core && installation) {
			const glob = this.createGlob(this.scan, installation);
			const op = new DirectoryScanOperation(this, glob);
			all.push(op.start());
			ops.push(op);
		}

		// Same for the user plugins folder.
		if (plugins) {
			const glob = this.createGlob(this.scan, plugins);
			const op = new DirectoryScanOperation(this, glob);
			all.push(op.start());
			ops.push(op);
		}

		// Start logging the progress now.
		await Promise.all(ops.map(op => op.filesPromise.promise));

		// Wait for everything to be read, and then build up the actual index.
		const results = await Promise.all(all);
		const flat = results.flat();
		const entries = this.entries = new TGIIndex(flat.length);
		for (let i = 0; i < entries.length; i++) {
			entries[i] = flat[i];
		}
		entries.build();
		return this;
	}

	// ## buildFamilies()
	// Builds up the index of all building & prop families by reading in all 
	// exemplars.
	async buildFamilies(opts: { concurrency?: number } = {}) {
		this.families = await buildFamilyIndex(this, opts);
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

		// For the entries itself, we won't serialize the TGI, because we will 
		// be able to re-use those from the binary index itself. However, we 
		// will need to serialize the offset, size and pointer to the dbpf they 
		// are part of.
		const { entries } = this;
		ws.writeUInt32LE(entries.length);
		for (let entry of entries) {
			const { offset, size } = entry;
			ws.writeUInt32LE(offset);
			ws.writeUInt32LE(size);
			const ptr = dbpfToIndex.get(entry.dbpf)!;
			ws.writeUInt32LE(ptr);
		}

		// Next we serialize the actual TGI index. This is relatively easy now, 
		// because we can simply re-use the underlying Uint32Arrays. Note that 
		// this means it depends on the system endianness.
		const index = entries.index.serialize();
		ws.writeUInt32LE(index.byteLength);
		ws.writeBuffer(index);

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
		return ws.toUint8Array();

	}

	// ## load(buffer)
	// Instead of building up an index, we can also read in a cache index. 
	// That's useful if we're often running a script on a large plugins folder 
	// where we're sure the folder doesn't change. We can gain a lot of precious 
	// time by reading in a cached version in this case!
	load(buffer: Uint8Array) {

		// First we'll read in all the dbpfs.
		const rs = SmartBuffer.fromBuffer(buffer);
		this.dbpfs = new Array(rs.readUInt32LE());
		for (let i = 0; i < this.dbpfs.length; i++) {
			const file = rs.readStringNT();
			this.dbpfs[i] = new DBPF({ file, parse: false });
		}

		// Next we'll restore all the entries. This is a bit special because we 
		// first have the list of offset, size & dbpf pointer, and then comes 
		// the buffer for the index, from which we read the TGIs.
		this.entries = new TGIIndex(rs.readUInt32LE());
		for (let i = 0; i < this.entries.length; i++) {
			const offset = rs.readUInt32LE();
			const size = rs.readUInt32LE();
			const ptr = rs.readUInt32LE();
			this.entries[i] = new Entry({
				offset,
				size,
				dbpf: this.dbpfs[ptr],
			});
		}

		// Reconstruct the index straight from the index buffer.
		const indexSize = rs.readUInt32LE();
		const indexBuffer = rs.readUint8Array(indexSize);
		this.entries.load(indexBuffer);
		const { tgis } = this.entries.index;
		for (let i = 0, iii = 0; i < this.entries.length; i++, iii += 3) {
			const type = tgis[iii];
			const group = tgis[iii+1];
			const instance = tgis[iii+2];
			this.entries[i].tgi = new TGI(type, group, instance);
		}

		// At last we'll restore the families as well.
		this.families = new Map();
		const size = rs.readUInt32LE();
		for (let i = 0; i < size; i++) {
			const family = rs.readUInt32LE();
			const tgis = new Array(rs.readUInt32LE());
			for (let i = 0; i < tgis.length; i++) {
				tgis[i] = new TGI(
					rs.readUInt32LE(),
					rs.readUInt32LE(),
					rs.readUInt32LE(),
				);
			}
			this.families.set(family, tgis);
		}
		return this;

	}

	// ## *[Symbol.iterator]() {
	*[Symbol.iterator]() {
		yield* this.entries;
	}

}
