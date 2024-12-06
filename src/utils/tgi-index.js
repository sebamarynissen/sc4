// # tgi-index.js

// # TGIIndex
// A data structure that allows for efficiently querying objects by (type, 
// group, instance).
export default class TGIIndex extends Array {
	index = null;

	// ## get values()
	get values() {
		return this;
	}

	// ## build()
	// A TGI collection doesn't create an index by default. We only do this when 
	// the build() is called. That way it becomes easy to use `.filter()` etc. 
	// without automatically rebuilding the index.
	build() {
		let tree = new Index(this);
		this.index = tree;
		this.dirty = false;
		return this;
	}

	// ## load(cache)
	// Loads an index from a cache instead of building it up ourselves.
	load(cache) {
		this.index = new Index().load(cache);
		this.dirty = false;
		return this;
	}

	// ## findOne(type, group, instance)
	findOne(query, g, i) {
		return this.findAll(query, g, i).at(-1) || null;
	}

	// ## find(type, group, instance)
	// Using `.find()` is discouraged because it is better to be explicit with 
	// One or All, but for backwards compatibility, `find` is an alias for 
	// `findOne()`.
	find(...args) {
		return this.findOne(...args);
	}

	// ## findAll(query)
	// General purposes method that finds *all* values bases on the given tgi 
	// query. Note that the way we look it up in the index depends on whether a 
	// type is given or not. Sometimes we might even not be able to use the 
	// index, which is fine in edge cases.
	findAll(query, group, instance) {

		// If the query is specified as a function, use it as such.
		if (typeof query === 'function') {
			return super.filter(query, group, instance);
		}

		// If we have no index, then we have no choice but to loop everything 
		// manually.
		let q = normalize(query, group, instance);
		if (this.index === null) {
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
					return get(this, this.index.tgi, hhh(t, g, i));
				} else {
					return get(this, this.index.ti, hh(t, i));
				}
			}

			// If we reach this point, the type is known, but the instance is 
			// for sure *not known*.
			let result = get(this, this.index.t, h(t));
			if (known(g)) {
				return result.filter(createFilter(q));
			} else {
				return result;
			}
		} else if (known(i)) {
			return get(this, this.index.i, h(i));
		}

		// If we reach this point, we can't use an index. Pity.
		return this.values.filter(createFilter(q));

	}

	// ## remove(query, g, i)
	// Removes a certain type, group, instance from the index. Note that this 
	// operation is O(1) because it is something that doesn't need to happen a 
	// lot. When the tgi index is really large, this typically happens when 
	// indexing plugin folders, where removing something isn't really something 
	// you want to do in that case! It is mainly used when editing DBPF files, 
	// in which case it's acceptable that it's a little slower.
	remove(query, g, i) {
		let removed;
		if (typeof query === 'function') {
			removed = filterInPlace(this, query);
		} else {
			let fn = createFilter(normalize(query, g, i));
			removed = filterInPlace(this, fn);
		}
		if (this.index) {
			this.dirty = true;
		}
		return removed.length;

	}

	// ## push(...tgis)
	// Adds a new tgi object to the index.
	push(...tgis) {
		super.push(...tgis);
		if (this.index) {
			this.dirty = true;
		}
		return tgis.length;
	}

	// ## add(tgi)
	// Alias for `.push()`.
	add(...args) {
		this.push(...args);
		return this;
	}

	// ## [Symbol.for('nodejs.util.inspect.custom')]
	[Symbol.for('nodejs.util.inspect.custom')](opts, level, inspect) {
		let c = { colors: true };
		return inspect([...this], c) + ` (indexed: ${inspect(!!this.index, c)})`;
	}

}

const known = x => x !== undefined;

// # Index
// Our actual index data structure. It's nothing more than a hash table 
// basically.
export class Index {

	tgi = new Map();
	ti = new Map();
	i = new Map();
	t = new Map();

	// ## constructor()
	constructor(entries = []) {
		for (let j = 0; j < entries.length; j++) {
			let entry = entries[j];
			let { type: t, group: g, instance: i } = entry;
			set(this.tgi, hhh(t, g, i), j);
			set(this.ti, hh(t, i), j);
			set(this.i, h(i), j);
			set(this.t, h(t), j);
		}
	}

	// ## load(cache)
	// Loads an index from cache.
	load(cache) {
		this.tgi = new Map(cache.tgi);
		this.ti = new Map(cache.ti);
		this.t = new Map(cache.t);
		this.i = new Map(cache.i);
		return this;
	}

	// ## toJSON()
	toJSON() {
		return {
			tgi: [...this.tgi.entries()],
			ti: [...this.ti.entries()],
			t: [...this.t.entries()],
			i: [...this.i.entries()],
		};
	}

}

// The hash functions we use for one, two or three values.
const h = t => t;
const hh = (t, g) => `${t}-${g}`;
const hhh = (t, g, i) => `${t}-${g}-${i}`;

// # get(arr, dict, key)
// Accessor function for easily reading values from our maps.
function get(arr, dict, key) {
	let ptrs = dict.get(key) ?? [];
	return ptrs.map(ptr => arr[ptr]);
}

// # set(dict, key, value)
function set(dict, key, value) {
	let arr = dict.get(key);
	if (arr) {
		arr.push(value);
	} else {
		dict.set(key, [value]);
	}
}

// # normalize(query, g, i)
function normalize(query, g, i) {
	let type, group, instance;
	if (typeof query === 'number') {
		type = query;
		group = g;
		instance = i;
	} else if (Array.isArray(query)) {
		[type, group, instance] = query;
	} else {
		({ type, group, instance } = query);
	}
	return { type, group, instance };
}

// # createFilter(query)
// Creates a filter function from a { type, group, instance } object some values 
// may be undefiend.
function createFilter({ type, group, instance }) {
	return entry => {
		return (
			(type > -1 ? entry.type === type : true) &&
			(group > -1 ? entry.group === group : true) &&
			(instance > -1 ? entry.instance === instance : true)
		);
	};
}

// # filterInPlace(array, condition)
// The in-place equivalent of Array.prototype.filter
function filterInPlace(array, condition) {
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
