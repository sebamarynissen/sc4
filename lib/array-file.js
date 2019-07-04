// # array-file.js
// Contains the base class we use for array-like files. This class extends the 
// base array class so that those file classes get all properties of arrays. 
// This is actually quite useful because that way we no longer have to refer 
// to the proxies all the time. Note that we actually export a class 
// **constructor** because we want to decorate it a bit.
"use strict";
const Stream = require('./stream');
const { typeDecorator } = require('./util');

// # ArrayFile
// The basic class extending the array and providing shared array 
// functionality.
class ArrayFile extends Array {

	// ## static type(ChildClass)
	// Helper function for decorating the array file class with a given type. 
	// Note that it would be better to use ES2016 decorators for this so that 
	// we can use
	// ```js
	// @type(0xbadc1a55);
	// class FloraFile extends ArrayFile {}
	// ```
	// instead. Unfortunately they are still in stage 2, so we won't be able 
	// to use them anytime soon.
	static type(ChildClass) {
		const decorator = typeDecorator(ChildClass.type);
		const Klass = decorator(class extends this {});
		Object.defineProperty(Klass.prototype, 'ChildClass', {
			"value": ChildClass,
			"enumerable": false,
			"writable": false,
			"configurable": false
		});
		return Klass;
	}

	// ## constructor()
	// Always call the super constructor without any arguments so that we 
	// always start empty.
	constructor() {
		super();
	}

	// ## *bgen(opts)
	// Returns a so called "binary generator". This one loops all records we 
	// have in the array-like file and yields a buffer from them - using the 
	// same "bgen" technique. This means that all of our children must 
	// implement a bgen method as well!
	*bgen(opts) {
		for (let item of this) {
			yield* item.bgen(opts);
		}
	}

	// ## toBuffer(opts)
	// Returns a buffer for the entire array-like file. Uses the binary 
	// generator under the hood to collect all buffers and then concatenate 
	// them.
	toBuffer(opts) {
		let all = Array.from(this.bgen(opts));
		return all.length === 1 ? all[0] : Buffer.concat(all);
	}

	// ## parse(buff)
	// The method used for parsing an array file from a buffer or 
	// stream-wrapped buffer. It requires that a child class is defined on the
	// array class' prototype.
	parse(buff) {
		const Child = this.ChildClass;
		let rs = buff instanceof Stream ? buff : new Stream(buff);
		while (!rs.eof()) {
			let child = new Child();
			child.parse(rs);
			this.push(child);
		}
		return this;
	}

}

module.exports = ArrayFile;