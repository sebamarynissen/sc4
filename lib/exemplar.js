// # exemplar.js
"use strict";
const Stream = require('./stream');
const NAMES = require('./exemplar-props');
const { makeEnum, invert, hex } = require('./util');

const Type = makeEnum([
	'Byte', 'Uint16', 'Uint32', 'Int32', 'BigInt64', 'Boolean', 'Float',
	'String'
]);

const TYPE_TO_HEX = Object.freeze({
	[Type.Int32]: 0x700,
	[Type.Uint32]: 0x300,
	[Type.Float]: 0x900,
	[Type.Boolean]: 0xB00,
	[Type.Byte]: 0x100,
	[Type.BigInt64]: 0x800,
	[Type.Uint16]: 0x200,
	[Type.String]: 0xc00,
});
const HEX_TO_TYPE = Object.freeze(invert(TYPE_TO_HEX));
const TYPE_TO_SIZE = Object.freeze({
	[Type.Int32]: 4,
	[Type.Uint32]: 4,
	[Type.Float]: 4,
	[Type.Boolean]: 1,
	[Type.Byte]: 1,
	[Type.BigInt64]: 8,
	[Type.Uint16]: 2,

	// This is for legacy purposes.
	[Type.String]: 1

});

const VALUE_READERS = Object.freeze({
	[Type.Int32]: rs => rs.int32(),
	[Type.Uint32]: rs => rs.uint32(),
	[Type.Float]: rs => rs.float(),
	[Type.Boolean]: rs => Boolean(rs.uint8()),
	[Type.Byte]: rs => rs.uint8(),
	[Type.BigInt64]: rs => rs.bigint64(),
	[Type.Uint16]: rs => rs.uint16(),
	[Type.String]: (rs, length) => rs.string(length)
});

const VALUE_WRITERS = Object.freeze({
	[Type.Int32]: (buff, ...rest) => buff.writeInt32LE(...rest),
	[Type.Uint32]: (buff, ...rest) => buff.writeUInt32LE(...rest),
	[Type.Float]: (buff, ...rest) => buff.writeFloatLE(...rest),
	[Type.Boolean]: (buff, value, ...rest) => buff.writeUInt8(Number(value), ...rest),
	[Type.Byte]: (buff, ...rest) => buff.writeUInt8(...rest),
	[Type.BigInt64]: (buff, ...rest) => buff.writeBigInt64LE(...rest),
	[Type.Uint16]: (buff, ...rest) => buff.writeUInt16(...rest),
	[Type.String]: (buff, ...rest) => buff.write(...rest)
});

// # Exemplar()
// See https://www.wiki.sc4devotion.com/index.php?title=EXMP for the spec.
module.exports = class Exemplar {

	// ## constructor(buff)
	constructor(buff) {
		this.parse(buff);
	}

	// ## parse(buff)
	// Parses an exemplar file from a buffer.
	parse(buff) {

		const rs = new Stream(buff);
		this.id = rs.string(8);

		// Get the parent cohort TGI. Set to 0 in case of no parent.
		this.parent = [rs.uint32(), rs.uint32(), rs.uint32()];

		// Read all properties one by one.
		const count = rs.uint32();
		const props = this.props = new Array(count);
		for (let i = 0; i < count; i++) {
			props[i] = new Property().parse(rs);
		}

		return this;

	}

	// ## *bgen()
	// A generator function that can be used to serialize the exemplar file 
	// into a buffer in a streamified way.
	*bgen() {

		// Construct our 24 byte header.
		const header = Buffer.allocUnsafe(24);
		let i = header.write(this.id);
		for (let tgi of this.parent) {
			i = header.writeUInt32LE(tgi, i);
		}

		// Write away the property count.
		i = header.writeUInt32LE(this.props.length, i);

		// Header is finished, report it.
		yield header;

		// Now for all properties, yield them.
		for (let prop of this.props) {
			yield* prop.bgen();
		}

	}

	// ## toBuffer()
	// Serializes the exemplar file into an uncompressed buffer. Can be used 
	// to save dbpf files again.
	toBuffer() {
		return Buffer.concat(Array.from(this.bgen()));
	}

};

// # Property()
// Wrapper class around an Exemplar property.
class Property {

	// ## constructor()
	constructor() {
		this.id = 0;
		this.type = 0;
		this.value = null;
	}

	// ## get hex()
	// Computed property that shows the hex value of the property name. Useful 
	// when comparing this with Reader, because Reader shows everything in hex 
	// by default.
	get hex() {
		return hex(this.id);
	}

	// ## get hexType()
	get hexType() {
		return TYPE_TO_HEX[this.type];
	}

	// ## get name()
	// Returns the string name for the property. Useful for debugging.
	get name() {
		return NAMES[this.id];
	}

	// ## get keyType()
	get keyType() {
		const value = this.value;
		return Array.isArray(value) || typeof value === 'string' ? 0x80 : 0x00;
	}

	// ## get multiple()
	get multiple() {
		return this.keyType === 0x80;
	}

	// ## get byteLength()
	// Computes the byteLength of the **value** part of the property. This 
	// means that it depends on whether the property contains multiple values, 
	// or only a single value. Note that strings are considered to hold 
	// multiple values because we need to store the string length here!
	get byteLength() {
		let { type, value } = this;
		let bytes = TYPE_TO_SIZE[type];
		return this.multiple ? (4 + value.length * bytes) : bytes;
	}

	// ## parse(rs)
	// Parses the property from a buffer wrapped up in a stream object that 
	// allows for easier reading.
	parse(rs) {

		this.id = rs.uint32();

		// Parse value type & associated reader.
		let type = this.type = HEX_TO_TYPE[rs.uint16()];
		let reader = VALUE_READERS[type];

		// Parse key type.
		let keyType = rs.uint16();

		if (keyType === 0) {
			let nr = rs.uint8();
			this.value = reader(rs);
		} else if (keyType === 0x80) {
			let unused = rs.uint8();
			let reps = rs.uint32();

			// If we're dealing with a string, read the string. Otherwise 
			// read the values using the repetitions. Note that this means 
			// that strings can't be repeated!
			if (type === String) {
				this.value = rs.string(reps);
			} else {
				let values = this.value = new Array(reps);
				for (let i = 0; i < reps; i++) {
					values[i] = reader(rs);
				}
			}
		}

		// Return ourselves.
		return this;

	}

	// ## *bgen(opts)
	// Yields a series of buffer objects that represent the serialized 
	// property.
	*bgen(opts) {

		// A property is small enough to be returned as single buffer. 
		// Pre-calculate it's size.
		let { type, value } = this;
		let buff = Buffer.allocUnsafe(4 + 2 + 2 + 1 + this.byteLength);

		// Write the property's numerical value.
		let i = 0;
		i = buff.writeUInt32LE(this.id, i);

		// Write the property's value type. Note that you should ensure 
		// yourself that the value type matches the actual type stored in the 
		// value!
		i = buff.writeUInt16LE(this.hexType, i);

		// Write away the key type. This depends on whether the value is an 
		// array or a string.
		i = buff.writeUInt16LE(this.keyType, i);

		// Unused flag.
		i = buff.writeUInt8(0, i);

		// Write away the values.
		if (typeof value === 'string') {
			i = buff.write(value);
		} else {
			const writer = VALUE_WRITERS[type];
			if (Array.isArray(value)) {
				i = buff.writeUInt32LE(value.length, i);
				for (let entry of value) {
					i = writer(buff, entry, i);
				}
			} else {
				i = writer(buff, value, i);
			}
		}

		// Yield the buffer, generator equivalent of return.
		yield buff;

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

}