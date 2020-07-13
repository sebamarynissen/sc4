// # exemplar.js
"use strict";
const Stream = require('./stream');
const NAMES = require('./exemplar-props');
const FileType = require('./file-types');
const LotObject = require('./lot-object');
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
class Exemplar {

	// ## get id()
	// Returns the type id of an exemplar file. This is always 
	static get id() {
		return FileType.Exemplar;
	}

	// ## constructor()
	constructor() {
		this.id = 'EQZB1###';
		this.parent = [0,0,0];
		this.props = [];
		this.table = null;
	}

	// ## get fileType()
	get fileType() {
		return FileType.Exemplar;
	}

	// ## get lotObjects()
	// Returns a list of all LotConfigPropertyLotObject properties in the 
	// exemplar. They always start at 0x88EDC900 and then continue one by one.
	get lotObjects() {
		const table = this.table;
		let i = 0x88EDC900;
		let out = [];
		let entry = table[i];
		while (entry) {
			out.push(new LotObject(entry));
			entry = table[ ++i ];
		}
		return out;
	}

	// ## prop(key)
	// Helper function for accessing a property.
	prop(key) {
		return this.table[ key ];
	}

	// ## value(key)
	// Helper function for directly accessing the value of a property.
	value(key) {
		let prop = this.prop(key);
		return prop ? prop.value : undefined;
	}

	// ## parse(buff)
	// Parses an exemplar file from a buffer.
	parse(buff) {

		const rs = new Stream(buff);
		let id = this.id = rs.string(8);

		// Check the id's 4the byte. If this is "T", then we're reading in a 
		// text exemplar. Otherwise we're reading a binary one. Can't find any 
		// documentation on the textual representation though, but ok.
		let text = id[3] === 'T';
		if (id[3] === 'T') {
			this.parseFromString(buff.toString('utf8'));

			// Not parsing for now.
			return this;
		}

		// Get the parent cohort TGI. Set to 0 in case of no parent.
		this.parent = [rs.uint32(), rs.uint32(), rs.uint32()];

		// Read all properties one by one.
		const count = rs.uint32();
		const props = this.props = new Array(count);
		const table = this.table = Object.create(null);
		for (let i = 0; i < count; i++) {
			let prop = props[i] = new Property();
			prop.parse(rs);
		}

		// Create the property table as well.
		this.createTable();

		return this;

	}

	// ## parseFromString(str)
	parseFromString(str) {
		let obj = parseString(str);
		this.parent = obj.parent;
		this.props = obj.props.map(function(def) {
			let type = Type[({
				"Uint8": "Byte",
				"Float32": "Float",
				"Sint64": "BigInt64",
				"Sint32": "Int32",
				"Bool": "Boolean"
			})[ def.type ] || def.type];
			return new Property(def.id, type, def.value);
		});

		// Create the property table as well.
		this.createTable();

		return this;
	}

	// ## createTable()
	createTable() {
		const table = this.table = Object.create(null);
		for (let prop of this.props) {
			for (let name of ['id', 'name']) {
				name = prop[name];
				if (name in table) {
					let arr = table[name];
					if (!Array.isArray(arr)) {
						table[name] = arr = [arr];
						arr = [arr];
					}
					arr.push(prop);
				} else {
					table[name] = prop;
				}
			}
		}
	}

	// ## *bgen()
	// A generator function that can be used to serialize the exemplar file 
	// into a buffer in a streamified way.
	*bgen() {

		// Construct our 24 byte header.
		const header = Buffer.allocUnsafe(24);
		let i = header.write(this.id);

		// Only use binary format for now.
		header.write('B', 3);
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
module.exports = Exemplar;

// # Property()
// Wrapper class around an Exemplar property.
class Property {

	// ## constructor(id, type, value)
	constructor(id = 0, type = 0, value = null) {
		this.id = id;
		this.name = NAMES[id] || '';
		this.type = type;
		this.value = value;
	}

	// ## [Symbol.toPrimitive]()
	// Casting the prop to a number will return the numeric value.
	[Symbol.toPrimitive](hint) {
		return hint === 'number' ? this.value : this.hex;
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
		this.name = NAMES[this.id];

		// Parse value type & associated reader.
		let nr = rs.uint16();
		let type = this.type = HEX_TO_TYPE[nr];
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
			if (type === Type.String) {
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
		let buff = Buffer.alloc(4 + 2 + 2 + 1 + this.byteLength);

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
			i = buff.writeUInt32LE(value.length, i);
			i = buff.write(value, i);
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

let val;
function parseString(str) {
	val = str;

	// Read the parent cohort.
	until('ParentCohort'); ws();
	until('='); ws();
	until(':'); ws();

	let parent = [
		readHex(),
		readHex(),
		readHex()
	];

	// Next hex we find is the prop count.
	const propCount = readHex();
	until('\n');

	let props = [];
	for (let i = 0; i < propCount; i++) {
		props.push(readProp());
	}

	return {
		"parent": parent,
		"props": props
	};

}

function advance(n) {
	val = val.slice(n);
}

function until(token) {
	let index = val.indexOf(token);
	advance(index+token.length);
}

// Consumes whitespace, but only if follows.
const whitespaceRegex = /\s+/;
function ws() {
	let match = val.match(whitespaceRegex);
	if (!match) return;
	if (match.index === 0) {
		advance(match[0].length);
	}
}

const hexRegex = /0x[0-9a-f]+/i;
function readHexString() {
	let match = val.match(hexRegex);
	advance(match.index+match[0].length);
	return match[0];
}

function readHex() {
	return Number(readHexString());
}

// Reads in a single property line.
function readProp() {

	// Work on a per-line basis so that we never surpass a line and read stuff 
	// from another property by accident.
	let index = val.indexOf('\n');
	let line = val.slice(0, index);
	advance(index);

	let temp = val;
	val = line;

	let id = readHex();
	until(':');

	// Read a potential comment.
	ws();
	let comment = readComment();

	// Read the values.
	until('=');

	// Read the type.
	index = val.indexOf(':');
	let type = val.slice(0, index);
	advance(index+1);

	// Read the resp.
	index = val.indexOf(':');
	let reps = Number(val.slice(0, index));
	advance(index+1);

	let value = readValue(type, reps);

	// Restore.
	val = temp;

	// Consume trailing whitespace.
	ws();

	return {
		"id": id,
		"comment": comment,
		"type": type,
		"value": value
	};

}

const commentRegex = /^{"(.*)"}/;
function readComment() {
	let match = val.match(commentRegex);
	if (!match) return;
	return match[1];
}

const stringRegex = /{"(.*)"}/;
function readValue(type, reps) {
	if (type === 'String') {
		let match = val.match(stringRegex);
		advance(match.index+match[0].length);
		return match[1];
	}

	if (reps === 0) {
		return readSingleValue(type);
	} else {
		let out = [];
		for (let i = 0; i < reps; i++) {
			out.push(readSingleValue(type));
		}
		return out;
	}

}

function readSingleValue(type) {
	switch (type) {
		case 'Uint32':
		case 'Uint16':
		case 'Uint8':
			return readHex();
		case 'Float32':
			return readFloat();
		case 'Sint64':
			return readBigInt();
		case 'Sint32':
			return readInt32();
		case 'Bool':
			return readBoolean();
		default:
			throw new Error('UNknown type "'+type+'"!');
	}
}

const floatRegex = /([+-]?\d+(\.\d+)?)/;
function readFloat(type) {
	let match = val.match(floatRegex);
	advance(match.index + match[0].length);
	return Number(match[1]);
}

function readBigInt() {
	let hex = readHexString();
	let buff = Buffer.from(hex.slice(2), 'hex');
	if (buff.readInt64BE) {
		return buff.readBigInt64BE(0);
	} else {
		buff.reverse();
		return buff.readBigInt64LE(0);
	}
}

function readInt32() {
	let hex = readHexString();
	let buff = Buffer.from(hex.slice(2), 'hex');
	return buff.readInt32BE(0);
}

const boolRegex = /(true|false)/i;
function readBoolean() {
	let match = val.match(boolRegex);
	advance(match.index + match[0].length);
	return String(match[0]).toLowerCase() === 'true';
}