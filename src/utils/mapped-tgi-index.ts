// # mapped-tgi-index.ts
// This file contains the legacy tgi indexing data structure that uses native JS 
// maps. We mainly keep it around for benchmarking purposes with the new, 
// ArrayBuffer-based index. For a huge plugins folder (~2m TGIs), this reduced 
// the build time of the index with 66% (3s -> 1s).
import type { TGILiteral } from 'sc4/types';
type u32 = number;

// # Index
// Our actual index data structure. It's nothing more than a hash table 
// basically.
type IndexKey = bigint;
type IndexValue = number[];
type IndexTuple = [IndexKey, IndexValue];
type IndexMap = Map<IndexKey, IndexValue>;
type IndexCache = {
	tgi: IndexTuple[];
	ti: IndexTuple[];
	t: IndexTuple[];
};

export type TGIIndexJSON = {
	tgi: [IndexKey, IndexValue][];
	ti: [IndexKey, IndexValue][];
	t: [IndexKey, IndexValue][];
};

// # MappedIndex()
export default class MappedIndex<T extends TGILiteral> {
	tgi: IndexMap = new Map();
	ti: IndexMap = new Map();
	t: IndexMap = new Map();

	// ## constructor()
	constructor(entries: T[] = []) {
		for (let j = 0; j < entries.length; j++) {
			let entry = entries[j];
			let { type: t, group: g, instance: i } = entry;
			set(this.tgi, hhh(t, g, i), j);
			set(this.ti, hh(t, i), j);
			set(this.t, h(t), j);
		}
	}

	// ## load(cache)
	// Loads an index from cache.
	load(cache: IndexCache) {
		this.tgi = new Map(cache.tgi);
		this.ti = new Map(cache.ti);
		this.t = new Map(cache.t);
		return this;
	}

	// ## findTGI()
	findTGI(t: u32, g: u32, i: u32) {
		return get(this.tgi, hhh(t, g, i));
	}

	// ## findType()
	findType(t: u32) {
		return get(this.t, h(t));
	}

	// ## findTI()
	findTI(t: u32, i: u32) {
		return get(this.ti, hh(t, i));
	}

	// ## toJSON()
	toJSON(): TGIIndexJSON {
		return {
			tgi: [...this.tgi.entries()],
			ti: [...this.ti.entries()],
			t: [...this.t.entries()],
		};
	}

}

// The hash functions we use for one, two or three values.
const h = (t: number) => BigInt(t);
const hh = (t: number, g: number) => BigInt(t) << 32n | BigInt(g);
const hhh = (t: number, g: number, i: number) =>
	BigInt(t) << 64n |
	BigInt(g) << 32n |
	BigInt(i);

// # get(arr, dict, key)
// Accessor function for easily reading values from our maps.
function get(
	dict: IndexMap,
	key: IndexKey,
): u32[] {
	return dict.get(key) ?? [];
}

// # set(dict, key, value)
function set(dict: IndexMap, key: IndexKey, value: u32) {
	let arr = dict.get(key);
	if (arr) {
		arr.push(value);
	} else {
		dict.set(key, [value]);
	}
}
