// # tgi-index.js
import { hex, tgi } from './util.js';
const h = hex;

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
		let tree = Object.groupBy(this, entry => h(entry.type));
		for (let key of Object.keys(tree)) {
			let byType = tree[key];
			let child = Object.groupBy(tree[key], entry => h(entry.instance));
			tree[key] = child;
			for (let key of Object.keys(child)) {
				child[key] = Object.groupBy(child[key], entry => {
					let id = tgi(entry.type, entry.group, entry.instance);
					(tree[id] ??= []).push(entry);
					return h(entry.group);
				});
			}
			child.all = byType;
		}
		this.index = tree;
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
	findAll(query, g, i) {

		// If the query is specified as a function, use it as such.
		if (typeof query === 'function') {
			return super.filter(query, g, i);
		}

		// If we have no index, then we have no choice but to loop everything 
		// manually.
		let q = normalize(query, g, i);
		if (this.index === null) {
			return super.filter(createFilter(q));
		}

		// If we have all three the props, we can do an exact lookup.
		let { type, group, instance } = q;
		let u = void 0;
		if (type !== u && group !== u && instance !== u) {
			return this.index[tgi(type, group, instance)] ?? [];
		}

		// If we have only the type, we've got that indexed as well.
		if (type !== u && group === u) {
			if (instance === u) {
				return this.index[h(type)]?.all || [];
			} else {
				let g = Object.values(this.index[h(type)]?.[h(instance)] ?? {});
				return g.flat();
			}
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

		// We're not done yet as we obviously still need to clear the tree 
		// structure.
		if (removed.length > 0 && this.index) {
			for (let { type, group, instance } of removed) {
				delete this.index[tgi(type, group, instance)];
				delete this.index[h(type)][h(instance)][h(group)];
			}
		}
		return removed.length;

	}

	// ## push(...tgis)
	// Adds a new tgi object to the index.
	push(...tgis) {
		super.push(...tgis);
		if (this.index) {
			for (let tgi of tgis) {
				let { type, group, instance } = tgi;
				let t = h(type);
				let g = h(group);
				let i = h(instance);
				let arr = (((this.index[t] ??= {})[g] ??= {})[i] ??= []);
				arr.push(tgi);
			}
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
