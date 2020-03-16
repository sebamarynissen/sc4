// # lot-index.js
"use strict";
const bsearch = require('binary-search-bounds');
const { FileType } = require('./enums.js');
const { hex } = require('./util.js');

// Exemplar properties we'll be using.
const LotConfigPropertySize = 0x88edc790;
const OccupantSize = 0x27812810;
const OccupantGroups = 0xaa1dd396;

// # LotIndex
// A helper class that we use to index lots by a few important properties. 
// They're sorted by height and such they will also remain so. This means that 
// when filtering, you can rest assured that they remain sorted by height as 
// well!
class LotIndex {

	// ## constructor(index)
	// Creates the lot index from the given file index.
	constructor(index) {

		// Store the file index, we'll still need it.
		this.fileIndex = index;
		this.lots = [];

		// Loop every exemplar. If it's a lot configurations exemplar, then 
		// read it so that we can find the building that appears on the lot.
		for (let entry of index.exemplars) {
			let file = entry.read();
			if (this.getPropertyValue(file, 0x10) !== 0x10) {
				continue;
			}

			// Cool, add the lot.
			this.add(entry);

		}

		// Now it's time to set up all our indices. For now we'll only index 
		// by height though.
		this.height = IndexedArray.create({
			compare(a, b) {
				return a.height - b.height;
			},
			entries: this.lots,
		});

	}

	// ## add(entry)
	// Adds the given lot exemplar to the index.
	add(entry) {

		// Find the building on the lot.
		let file = entry.read();
		let { lotObjects } = file;
		let rep = lotObjects.find(({ type }) => type === 0x00);
		let IID = rep.IID;
		let building = this.getBuilding(IID);

		// Read in the lot size.
		let size = this.getPropertyValue(file, LotConfigPropertySize);

		// Read in the building size as that is our main indexing property.
		let [width, height, depth] = this.getPropertyValue(
			building, OccupantSize,
		);

		// At last, create our entry.
		this.lots.push({
			lot: entry,
			height,
			size,
		});

	}

	// ## getBuilding(IID)
	getBuilding(IID) {
		let buildings = this.fileIndex
			.findAllTI(FileType.Exemplar, IID)
			.filter(entry => {
				let file = entry.read();
				let type = this.getPropertyValue(file, 0x10);
				return type === 0x02;
			});
		if (buildings.length) {
			return buildings[0].read();
		}

		// No building found? Don't worry, check the families.
		let family = this.fileIndex.family(IID);
		if (!family) {
			throw new Error([
				`No building found with IID ${ hex(IID) }!`
			]);
		}
		return family[0].read();

	}

	// ## getPropertyValue(file, prop)
	// Helper function for quickly reading property values.
	getPropertyValue(file, prop) {
		return this.fileIndex.getPropertyValue(file, prop);
	}

}
module.exports = LotIndex;

// ## IndexedArray
// An extension of an array that takes into account that the array is sorted 
// using a certain comparator - which is to be specified by *extending* the 
// IndexedArray. Very useful to perform efficient range queries.
class IndexedArray extends Array {

	// ## static extend(compare)
	static extend(compare) {
		const Child = class IndexedArray extends this {};
		Child.prototype.compare = compare;
		return Child;
	}

	// ## static create(opts)
	static create(opts) {
		let { compare, entries = [] } = opts;
		const Child = this.extend(compare);
		let index = new Child(...entries);
		index.sort();
		return index;
	}

	// ## getRangeIndices(min, max)
	getRangeIndices(min, max) {
		const { compare } = this;
		let first = bsearch.le(this, min, compare)+1;
		let last = bsearch.ge(this, max, compare);
		return [first, last];
	}

	// ## range(min, max)
	// Filters down the subselection to only include the given height range.
	// Note: perhaps that we should find a way to change the index criterion 
	// easily, that's for later on though.
	range(min, max) {
		let [first, last] = this.getRangeIndices(min, max);
		return this.slice(first, last);
	}

	// ## *it(min, max)
	// Helper function which allows a range to be used as an iterator.
	*it(min, max) {
		let [first, last] = this.getRangeIndices(min, max);
		for (let i = first; i < last; i++) {
			yield this[i];
		}
	}

	// ## query(query)
	// Helper function for carrying out a query using the normal array filter 
	// method. Only exact queries are possible for the moment, no range 
	// queries though that should be possible as well - see MongoDB for 
	// example.
	query(query) {

		// First of all we'll build the query. Building the query means that 
		// we're creating an array of functions which *all* need to pass in 
		// order to evaluate to true. This means an "and" condition.
		let filters = [];
		for (let key in query) {
			let def = query[key];

			// If the definition is an array, we'll check whether the value is 
			// within the array.
			if (Array.isArray(def)) {
				filters.push($oneOf(key, def));
			} else {
				filters.push($equals(key, def));
			}

		}

		const keys = Object.keys(query);
		return this.filter(function(entry) {
			for (let fn of filters) {
				if (!fn(entry)) {
					return false;
				}
			}
			return true;
		});
	}

	// ## sort()
	// Sorts the indexed array. Normally this shouldn't be necessary to call 
	// manually by the way, but we need call this once upon creation!
	sort() {
		return super.sort(this.compare);
	}

}

// ## compare(a, b)
// The function we use to sort all lots by height.
function compare(a, b) {
	return a.height - b.height;
}

// ## contains(arr, it)
// Helper function for checking if the given array includes *one* of the 
// elements in the given iterator.
function contains(arr, it) {
	for (let el of it) {
		if (arr.includes(el)) {
			return true;
		}
	}
	return false;
}

// ## $equals(key, value)
function $equals(key, value) {
	return function(entry) {
		return entry[key] === value;
	}
}

// ## $oneOf(key, arr)
function $oneOf(key, arr) {
	return function(entry) {
		return arr.includes(entry[key]);
	}
}
