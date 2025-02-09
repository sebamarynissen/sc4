// # tgi-index.ts
import type { TGIQuery, TGILiteral, uint32, TGIArray } from 'sc4/types';
import MappedIndex from './mapped-tgi-index.js';
import BinaryIndex from './binary-tgi-index.js';
export type { TGIIndexJSON } from './mapped-tgi-index.js';

export type { TGIQuery, TGILiteral };
export type SingleResult<T> = T | undefined;
export type ArrayResult<T> = T[];
type Predicate<T, S extends T = T> = 
	| ((entry: T, index?: number, ctx?: T[]) => unknown)
	| ((entry: T, index?: number, ctx?: T[]) => entry is S);
export type TGIPredicate<T, S extends T = T> = Predicate<T, S>;

export type FindParameters<T> =
	| [type: uint32, group: uint32, instance: uint32]
	| [query: TGIQuery]
	| [query: TGIArray]
	| [predicate: TGIPredicate<T>, thisArg?: any];

// # TGIIndex
// A data structure that allows for efficiently querying objects by (type, 
// group, instance).
export default class TGIIndex<T extends TGILiteral = TGILiteral> extends Array<T> {
	index: MappedIndex<T> | BinaryIndex;
	dirty = false;

	// ## build()
	// A TGI collection doesn't create an index by default. We only do this when 
	// the build() is called. That way it becomes easy to use `.filter()` etc. 
	// without automatically rebuilding the index.
	build() {
		// let tree = new MappedIndex(this);
		let tree = BinaryIndex.fromEntries(this as TGILiteral[]);
		this.index = tree;
		this.dirty = false;
		return this;
	}

	// ## load(cache)
	// Loads an index from a cache instead of building it up ourselves.
	load(cache: any) {
		return this;
		// this.index = new Index().load(cache);
		// this.dirty = false;
		// return this;
	}

	// ## find(type, group, instance)
	find(type: number, group: number, instance: number): SingleResult<T>;
	find(query: TGIQuery): SingleResult<T>;
	find(query: TGIArray): SingleResult<T>;
	find<S extends T = T>(predicate: TGIPredicate<T, S>, thisArg?: any): SingleResult<S>;
	find(...args: FindParameters<T>): SingleResult<T> {
		let result = this.findAll(...args as Parameters<TGIIndex<T>['findAll']>);
		return result.at(-1);
	}

	// ## findAll(query)
	// General purposes method that finds *all* values bases on the given tgi 
	// query. Note that the way we look it up in the index depends on whether a 
	// type is given or not. Sometimes we might even not be able to use the 
	// index, which is fine in edge cases.
	findAll(type: number, group: number, instance: number): ArrayResult<T>;
	findAll(query: TGIQuery): ArrayResult<T>;
	findAll(query: TGIArray): ArrayResult<T>;
	findAll<S extends T = T>(predicate: TGIPredicate<T, S>, thisArg?: any): ArrayResult<S>;
	findAll(query: FindParameters<T>[0], group?: number | any, instance?: number): ArrayResult<T> {

		// If the query is specified as a function, use it as such.
		if (typeof query === 'function') {
			return super.filter(query, group);
		}

		// If we have no index, then we have no choice but to loop everything 
		// manually.
		let q = normalize(query, group, instance);
		if (!q) return [];
		if (!this.index) {
			return super.filter(createFilter(q));
		}

		// If the index is dirty, we first have to rebuild it.
		if (this.dirty) {
			this.build();
		}

		// If we have all three the props, we can do an exact lookup.
		const { type: t, group: g, instance: i } = q;
		if (known(t)) {
			if (known(i)) {
				if (known(g)) {
					return this.expand(this.index.findTGI(t, g, i));
				} else {
					return this.expand(this.index.findTI(t, i));
				}
			}

			// If we reach this point, the type is known, but the instance is 
			// for sure *not known*.
			let result = this.expand(this.index.findType(t));
			if (known(g)) {
				return result.filter(createFilter(q));
			} else {
				return result;
			}
		}

		// If we reach this point, we can't use an index. Pity.
		return this.filter(createFilter(q));

	}

	// ## expand(pointers)
	// Accepts an array of pointers - i.e. indices - that the index has found, 
	// and then we fill in - we *expand* - the actual entries from our array.
	private expand(pointers: number[] | Uint32Array) {
		let output = [];
		for (let i = 0; i < pointers.length; i++) {
			output[i] = this[pointers[i]];
		}
		return output;
	}

	// ## remove(query, g, i)
	// Removes a certain type, group, instance from the index. Note that this 
	// operation is O(1) because it is something that doesn't need to happen a 
	// lot. When the tgi index is really large, this typically happens when 
	// indexing plugin folders, where removing something isn't really something 
	// you want to do in that case! It is mainly used when editing DBPF files, 
	// in which case it's acceptable that it's a little slower.
	remove(fn: TGIPredicate<T>): number;
	remove(query: TGIQuery): number;
	remove(query: TGIArray): number;
	remove(type: number, group: number, instance: number) : number;
	remove(query: FindParameters<T>[0], g?: number, i?: number): number {
		let removed;
		if (typeof query === 'function') {
			removed = filterInPlace<T>(this, invert(query));
		} else {
			let normalizedQuery = normalize(query, g, i);
			if (!normalizedQuery) return 0;
			removed = filterInPlace<T>(this, invert(createFilter(normalizedQuery)));
		}
		if (this.index) {
			this.dirty = true;
		}
		return removed.length;

	}

	// ## push(...tgis)
	// Adds a new tgi object to the index.
	push(...tgis: T[]) {
		super.push(...tgis);
		if (this.index) {
			this.dirty = true;
		}
		return tgis.length;
	}

	// ## add(tgi)
	// Alias for `.push()`.
	add(...args: T[]) {
		this.push(...args);
		return this;
	}

	// ## [Symbol.for('nodejs.util.inspect.custom')]
	[Symbol.for('nodejs.util.inspect.custom')](
		_opts: object,
		_level: number,
		inspect: Function
	) {
		let c = { colors: true };
		return inspect([...this], c) + ` (indexed: ${inspect(!!this.index, c)})`;
	}

}

const known = (x: uint32 | undefined): x is uint32 => x !== undefined;

// # normalize(query, g, i)
function normalize(
	query: TGIQuery | number[] | number,
	g?: number,
	i?: number,
): TGIQuery | null{
	let type: number | undefined;
	let group: number | undefined;
	let instance: number | undefined;
	if (typeof query === 'number') {
		type = query;
		group = g;
		instance = i;
	} else if (Array.isArray(query)) {
		[type, group, instance] = query;
	} else {
		({ type, group, instance } = query);
	}
	if (
		type === undefined &&
		group === undefined &&
		instance === undefined
	) {
		if (process.env.NODE_ENV !== 'test') {
			console.warn('You provided an empty TGI query. Please verify if this is intentional! To avoid performance problems, this returns an empty result instead of all entries.');
		}
		return null;
	}
	let result: any = {};
	if (type !== undefined) result.type = type;
	if (group !== undefined) result.group = group;
	if (instance !== undefined) result.instance = instance;
	return result as TGIQuery;
}

// # createFilter(query)
// Creates a filter function from a { type, group, instance } object some values 
// may be undefiend.
function createFilter<T extends TGILiteral>({ type, group, instance }: TGIQuery) {
	return (entry: T) => {
		return (
			(type! > -1 ? entry.type === type : true) &&
			(group! > -1 ? entry.group === group : true) &&
			(instance! > -1 ? entry.instance === instance : true)
		);
	};
}

// # filterInPlace(array, condition)
// The in-place equivalent of Array.prototype.filter
function filterInPlace<T, S extends T = T>(
	array: T[],
	condition: Predicate<T, S>,
) {
	let out = [];
	let i = 0, j = 0;
	while (i < array.length) {
		const val = array[i];
		if (condition(val, i, array)) {
			array[j++] = val;
		} else {
			out.push(val);
		}
		i++;
	}
	array.length = j;
	return out;
}

// # invert(fn)
// Curries a function to return the boolean inverse. This is used for removing 
// entries again, because in that case we have to invert obviously.
function invert(fn: (...args: any[]) => any) {
	return function(...args: any[]) {
		return !fn(...args);
	}
}
