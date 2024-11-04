// # type.js
'use strict';
const Stream = require('./stream.js');
const { typeDecorator, hex } = require('./util.js');

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
		if (this.ArrayClass) return this.ArrayClass;

		// If no array class defined yet, create a "blank" one.
		return this.ArrayClass = TypedArray.type(this);
		
	}

	// ## [Symbol.toPrimitive]()
	// Converts the class to a primitive. We'll simply return the type id here 
	// so that the type id can be accessed as Number(Type) (or +Type as well).
	static [Symbol.toPrimitive]() {
		return this.type;
	}

	// ## toString()
	// toString()
	static toString() {
		return `${this.name} (${ hex(this.type) })`;
	}

	// ## [Symbol.toStringTag]
	// Returns a string that will be visible when converting an object of this 
	// type to a string.
	get [Symbol.toStringTag]() {
		return this.constructor.toString();
	}

	// ## [Symbol.toPrimitive](hint)
	[Symbol.toPrimitive](hint) {
		if (hint === 'number') {
			return this.mem;
		} else {
			return hex(this.mem);
		}
	}

	// ## toBuffer(opts)
	// Most types share the same method of creating a buffer, being by using a 
	// binary generator under the hood.
	toBuffer(opts) {
		throw new Error('Please implement `.toBuffer()` in your class!');
	}

}

// Specific array-type class. We cannot extend the Type class here because we 
// need to subclass a native array. Hence we'll mixin the type class instead.
const ArrayType = Type.ArrayType = class ArrayType extends Array {};
const descs = Object.getOwnPropertyDescriptors(Type.prototype);
Object.defineProperties(Type.ArrayType.prototype, descs);

// # createType(type)
// The function that we actually export. When called it will return a 
// decorated sub-class of "Type" that contains the required type id.
function createType(type) {
	const decorator = typeDecorator(type);
	return decorator(class extends Type {});
}
module.exports = createType;

// # createType.ArrayType(type)
// Counterpart for creating types that inherit directly from an array. Note 
// that this is different from Type.Array! Here the **single** record simply 
// has an array structure, regardless of what's inside of it!
createType.ArrayType = function createArrayType(type) {
	const decorator = typeDecorator(type);
	return decorator(class extends ArrayType {});
};

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
			value: ChildClass,
			enumerable: false,
			writable: false,
			configurable: false,
		});

		// Decorate toPrimitive etc as well.
		Object.defineProperty(Klass, Symbol.toPrimitive, {
			value: ChildClass[Symbol.toPrimitive],
			enumerable: false,
			writable: false,
			configurable: false,
		});

		return Klass;
	}

	// ## constructor()
	// Always call the super constructor without any arguments so that we 
	// always start empty.
	constructor(...args) {
		super();
	}

	// ## *bgen(opts)
	// Returns a so called "binary generator". This one loops all records we 
	// have in the array-like file and yields a buffer for each one of them. 
	// Note that a binary generator is actually useful here because it allows 
	// us to stream large files! No need to concatenate everything together 
	// here because no checksum is required to be calculated!
	*bgen(opts) {
		for (let item of this) {
			yield item.toBuffer();
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

		// Every record in an array sub file always has the same SIZE CRC 
		// RECORD header, which means that we can grab the correct underlying 
		// buffer and pass it to the child class. We didn't do this before, 
		// fearing that it might be a problem for prop poxed cities, but we 
		// can't read those anyway, so it's not a problem lol. Even better, if 
		// only 1 entry is corrupt, we should be able to continue. The *huge* 
		// upside of this is also that we don't have to *consume* the entire 
		// record anymore, which was vital before!
		const Child = this.ChildClass;
		let i = 0;
		while (i < buff.length) {

			// Create a buffer for the specific slice, which is a *view* and 
			// not a full copy obviously, which is what buffer.slice() returns.
			let size = buff.readUInt32LE(i);
			let slice = buff.slice(i, i+size);
			i += size;

			// Now parse a new child from it and push it in.
			let rs = new Stream(slice);
			let child = new Child();
			child.parse(rs);
			this.push(child);

		}
		return this;
		
	}

}
