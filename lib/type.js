// # type.js
"use strict";
const Stream = require('./stream');
const { typeDecorator } = require('./util');

// # Type
// A base class that we use to represent the different items in a savegame. 
// Note that we use subclassing now, but it would actually be more useful to 
// be able to use decorators for setting the type. That way we could subclass 
// something else.
class Type {

	// ## static createTypedArray()
	// Returns an array file from this type. Note that this means that a 
	// **class** is returned!
	static get Array() {
		return this._typedArray || (this._typedArray = TypedArray.type(this));
	}

}

// # createType(type)
// The function that we actually export. When called it will return a 
// decorated sub-class of "Type" that contains the required type id.
function createType(type) {
	const decorator = typeDecorator(type);
	return decorator(class extends Type {});
}
module.exports = createType;

// # TypedArray
// Basic class that can be used for creating a kind of "typed array". This 
// means an array that only contains items of the given type.
class TypedArray extends Array {

	// ## static type(ChildClass)
	// Helper function for decorating the array file class with a given type. 
	// Note that it would be better to use ES2016 decorators for this so that 
	// we can use
	// ```js
	// @type(0xbadc1a55);
	// class FloraFile extends TypedArray {}
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