// # shared.js
// Note: this file should be re-written a bit.
"use strict";

// Exports.
exports.isDef = isDef;
exports.isUndef = isUndef;
exports.isNumber = isNumber;
exports.isFunction = isFunction;
exports.isPrimitive = isPrimitive;
exports.has = has;
exports.noop = noop;
exports.xor = xor;
exports.ident = ident;
exports.cached = cached;
exports.weaklyCached = weaklyCached;
exports.compare = compare;
exports.uuid = b;

function isDef (v) {
	return v !== undefined && v !== null;
}

function isUndef (v) {
	return v === undefined || v === null;
}

function isNumber(x) {
	return typeof x === 'number';
}

function isFunction(x) {
	return typeof x === 'function';
}

function isString(x) {
	return typeof x === 'string';
}

function isPrimitive (value) {
	return (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'symbol' ||
		typeof value === 'boolean'
	)
}

function has(obj, prop) {
	return Object.prototype.hasOwnProperty.call(obj, prop);
}

// # noop()
// Does nothing.
function noop() {}

// # xor(a, b)
function xor(a, b) {
	return a ? !b : b;
}

// # ident(x)
// SImply returns the input argument.
function ident(x) {
	return x;
}

// # cached(fn, hash)
// Wraps up the given function so that it caches results based on its input.
function cached(fn, hash) {
	let map = new Map();
	if (!hash) hash = ident;
	return function(...args) {
		let key = hash(...args);
		if (map.has(key)) return map.get(key);
		let result = fn.apply(this, args);
		map.set(key, result);
		return result;
	};
}

// # weaklyCached(fn)
// Similar to the "cached" function, but now uses a weakmap underneath so that 
// we don't mess with the garbage collection. For obvious reasons this 
// function can't accept a hash function because the keys are weak, so the 
// hash function would have to return non-primitives!
function weaklyCached(fn) {
	let map = new WeakMap();
	return function(key) {
		if (map.has(key)) return map.get(key);
		let result = fn.call(this, key);
		map.set(key, result);
		return result;
	};
}

// # compare(tolerance)
// Returns a factory that returns a comparator function that returns whether 
// the given values are equal within the pre-defined tolerance.
function compare(tolerance) {
	return function(a, b) {
		return Math.abs(a - b) < tolerance;
	};
};

// Taken from https://gist.github.com/jed/982883
function b(a){return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,b)};

// # listenToMixin()
// A mixin that exposes a listenTo() and stopListening() method, just like 
// Backbone has, but now to work with various event libraries, most notably 
// three js.
const listeningTo = Symbol('listeningTo');
exports.listenToMixin = {

	// ## listenTo(obj, name, cb)
	listenTo(obj, name, cb) {

		if (!obj) return this;

		// Check what event api the obj supports and listen as required. Note 
		// that we do this first before setting up the bookkeeping so that if 
		// an error gets thrown, we don't set up our bookkeeping!
		if (isFunction(obj.addEventListener)) {
			obj.addEventListener(name, cb);
		}

		// Check if we're already listening to objects. If not, set up the map 
		// for listening to objects - a WeakMap of course.
		let map = this[listeningTo] || (this[listeningTo] = new Map());

		// Check if `this` object is already listening to obj. If not, create 
		// a new object containing all listeners for this object.
		let listeners = map.get(obj);
		if (!listeners) {
			map.set(obj, listeners = {});
		}

		// Store what event we've been listening to.
		let list = listeners[name] || (listeners[name] = []);
		list.push(cb);

		// Done.
		return this;

	},

	// ## stopListening(obj?, name?, cb?)
	// Removes the event listeners again on the given object.
	stopListening(obj, name, cb) {

		// Not listening to anything? Don't do anything.
		let map = this[listeningTo];
		if (!map) return this;

		// If no object was specified, cool, remove all listeners from all 
		// objects.
		let objects = obj ? [obj] : Array.from(this[listeningTo].keys());

		// Loop all objects for which we need to stop listening. The loop is 
		// just for convenience for when we're removing all listeners.
		for (let obj of objects) {
			let listeners = map.get(obj);
			if (!listeners) continue;

			// Check the events that should be removed.
			let events = name ? [name] : Object.keys(listeners);
			for (let name of events) {
				let list = listeners[name];
				if (!list) continue;

				// Allright, now if a specific callback was given, remove it 
				// from the list and then stop listening. If no specific 
				// callback was given, remove them all.
				if (isFunction(cb)) {
					list.splice(list.indexOf(cb), 1);
					removeEvent(obj, name, fn);
				}
				else {
					for (let fn of list.slice(0)) {
						removeEvent(obj, name, fn);
					}
					delete listeners[name];
				}

			}

			// Ok, if no more listeners are present, remove the object from 
			// the map as well.
			if (Object.keys(listeners).length === 0) {
				map.delete(obj);
			}

		}

	}

};

function removeEvent(obj, name, fn) {
	if (isFunction(obj.removeEventListener)) {
		obj.removeEventListener(name, fn);
	}
}