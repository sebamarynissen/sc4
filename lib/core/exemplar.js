// # exemplar.js
import { Buffer } from 'buffer';
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import NAMES from './exemplar-props.js';
import FileType from './file-types.js';
import LotObject from './lot-object.js';
import { makeEnum, invert, hex } from 'sc4/utils';

const Type = makeEnum([
	'Byte', 'Uint16', 'Uint32', 'Int32', 'BigInt64', 'Boolean', 'Float',
	'String',
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
	[Type.String]: 1,

});

const VALUE_READERS = Object.freeze({
	[Type.Int32]: rs => rs.int32(),
	[Type.Uint32]: rs => rs.uint32(),
	[Type.Float]: rs => rs.float(),
	[Type.Boolean]: rs => Boolean(rs.uint8()),
	[Type.Byte]: rs => rs.uint8(),
	[Type.BigInt64]: rs => rs.bigint64(),
	[Type.Uint16]: rs => rs.uint16(),
	[Type.String]: (rs, length) => rs.string(length),
});

const VALUE_WRITERS = Object.freeze({
	[Type.Int32]: (buff, ...rest) => buff.writeInt32LE(...rest),
	[Type.Uint32]: (buff, ...rest) => buff.writeUInt32LE(...rest),
	[Type.Float]: (buff, ...rest) => buff.writeFloatLE(...rest),
	[Type.Boolean]: (buff, value, ...rest) => buff.writeUInt8(Number(value), ...rest),
	[Type.Byte]: (buff, ...rest) => buff.writeUInt8(...rest),
	[Type.BigInt64]: (buff, ...rest) => buff.writeBigInt64LE(...rest),
	[Type.Uint16]: (buff, ...rest) => buff.writeUInt16(...rest),
	[Type.String]: (buff, ...rest) => buff.write(...rest),
});

// # Exemplar()
// See https://www.wiki.sc4devotion.com/index.php?title=EXMP for the spec.
export class Exemplar {

	static [Symbol.for('sc4.type')] = FileType.Exemplar;

	// ## constructor(data = {})
	// Creates a new exemplar. Note that this should support copy-constructing.
	constructor(data = {}) {
		const isClone = data instanceof this.constructor;
		this.id = data.id || 'EQZB1###';
		this.parent = data.parent || [0, 0, 0];
		this.props = [...data.props || []].map(def => {
			return isClone ? new Property(def) : def;
		});
		Object.defineProperty(this, 'table', {
			enumerable: false,
			configurable: true,
			writable: true,
			value: null,
		});

		// Immediately create the table upon construction.
		this.createTable();

	}

	// ## clone()
	clone() {
		return new Exemplar(this);
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

	// ## singleValue(key)
	// Ensures that the value return is never an array. This is to handle cases 
	// where properties that normally shouldn't be arrays, are still stored as 
	// 1-element arrays in an examplar,
	singleValue(key) {
		let value = this.value(key);
		return Array.isArray(value) ? value[0] : value;
	}

	// ## addProperty(id, value, typeHint)
	// Adds a property to the exemplar file. Note that we automatically use 
	// Uint32 as a default for numbers, but this can obviously be set to 
	// something specific.
	addProperty(id, value, typeHint = 'Uint32') {
		let type;
		if (typeof value === 'string') {
			type = Type.String;
		} else if (typeof value === 'bigint') {
			type = Type.BigInt64;
		} else if (typeof value === 'boolean') {
			type = Type.Boolean;
		} else {
			type = typeHint;
		}
		let prop = new Property({
			id,
			type: Type[type] || type,
			value,
		});
		this.props.push(prop);
	}

	// ## parse(bufferOrStream)
	// Parses an exemplar file from a buffer.
	parse(bufferOrStream) {

		const rs = new Stream(bufferOrStream);
		let id = this.id = rs.string(8);

		// Check the id's 4the byte. If this is "T", then we're reading in a 
		// text exemplar. Otherwise we're reading a binary one. Can't find any 
		// documentation on the textual representation though, but ok.
		let isText = id[3] === 'T';
		if (isText) {
			this.parseFromString(rs.string(Infinity));

			// Not parsing for now.
			return this;
		}

		// Get the parent cohort TGI. Set to 0 in case of no parent.
		this.parent = [rs.uint32(), rs.uint32(), rs.uint32()];

		// Read all properties one by one.
		const count = rs.uint32();
		const props = this.props = new Array(count);
		this.table = Object.create(null);
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
				Uint8: 'Byte',
				Float32: 'Float',
				Sint64: 'BigInt64',
				Sint32: 'Int32',
				Bool: 'Boolean',
			})[ def.type ] || def.type];
			return new Property({
				id: def.id,
				type,
				value: def.value,
			});
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

	// ## toBuffer()
	// Serializes the exemplar file into an uncompressed buffer. Can be used 
	// to save dbpf files again.
	toBuffer() {

		// Initialze the buffer.
		let buffer = new WriteBuffer();

		// Write away the id, but only use the binary format for now, so 
		// ensure the 4th byte is the character B.
		let header = Buffer.allocUnsafe(this.id.length);
		header.write(this.id);
		header.write('B', 3);
		buffer.write(header);
		for (let tgi of this.parent) {
			buffer.writeUInt32LE(tgi);
		}

		// Write all properties to the buffer as well. Note that writing 
		// arrays is handled automatically.
		buffer.array(this.props);
		return buffer.toBuffer();

	}

}

// # Cohort
// A cohort is a specific kind of exemplar. There are no differences, except for 
// the type id and the id field.
export class Cohort extends Exemplar {
	static [Symbol.for('sc4.type')] = FileType.Cohort;
	id = 'CQZB1###';
}

// # Property()
// Wrapper class around an Exemplar property.
class Property {

	// ## constructor({ id, type, value } = {})
	// If the data passed is a property, then we'll use a *clone* strategy.
	constructor(data = {}) {
		let isClone = data instanceof Property;
		let { id = 0, type = 0, value } = data;
		this.id = id;
		this.type = type;
		this.value = isClone ? structuredClone(value) : value;
	}

	// ## get name()
	get name() {
		return NAMES[this.id] ?? '';
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

		// Parse value type & associated reader.
		let nr = rs.uint16();
		let type = this.type = HEX_TO_TYPE[nr];
		let reader = VALUE_READERS[type];

		// Parse key type.
		let keyType = rs.uint16();

		if (keyType === 0) {
			void rs.uint8();
			this.value = reader(rs);
		} else if (keyType === 0x80) {
			void rs.uint8();
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

	// ## toBuffer()
	// Serializes the property to a binary buffer.
	toBuffer() {

		// A property is small enough to be returned as single buffer. 
		// Pre-calculate it's size.
		let { type, value } = this;
		let buff = new WriteBuffer();

		// Write the property's numerical value.
		buff.writeUInt32LE(this.id);
		
		// Write the property's value type. Note that you should ensure 
		// yourself that the value type matches the actual type stored in the 
		// value!
		buff.writeUInt16LE(this.hexType);

		// Write away the key type. This depends on whether the value is an 
		// array or a string.
		buff.writeUInt16LE(this.keyType);

		// Unused flag.
		buff.writeUInt8(0);

		// Write away the values.
		if (typeof value === 'string') {
			buff.string(value);
		} else {
			const writer = VALUE_WRITERS[type];
			if (Array.isArray(value)) {
				buff.writeUInt32LE(value.length);
				for (let entry of value) {
					writer(buff, entry);
				}
			} else {
				writer(buff, value);
			}
		}
		return buff.toBuffer();

	}

	// ## [Symbol.for('nodejs.util.inspect.custom')](depth, opts, inspect)
	// Allow custom inspection in Node.js
	[Symbol.for('nodejs.util.inspect.custom')](depth, opts, inspect) {
		return inspect({
			id: hex(this.id),
			name: this.name,
			type: this.type,
			value: this.value,
		}, opts);
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
		readHex(),
	];

	// Next hex we find is the prop count.
	const propCount = readHex();
	until('\n');

	let props = [];
	for (let i = 0; i < propCount; i++) {
		props.push(readProp());
	}

	return {
		parent,
		props,
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
	if (!match) return undefined;
	advance(match.index+match[0].length);
	return match[0];
}

function readHex() {
	let str = readHexString();
	if (str === undefined) return undefined;
	return Number(str);
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

	return { id, comment, type, value };

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
			throw new Error('Unknown type "'+type+'"!');
	}
}

const floatRegex = /([+-]?\d+(\.\d+)?)/;
function readFloat(type) {
	let match = val.match(floatRegex);
	if (!match) return undefined;
	advance(match.index + match[0].length);
	return Number(match[1]);
}

function readBigInt() {
	let hex = readHexString();
	if (hex === undefined) return undefined;
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
	if (hex === undefined) return undefined;
	let buff = Buffer.from(hex.slice(2), 'hex');
	return buff.readInt32BE(0);
}

const boolRegex = /(true|false)/i;
function readBoolean() {
	let match = val.match(boolRegex);
	if (!match) return undefined;
	advance(match.index + match[0].length);
	return String(match[0]).toLowerCase() === 'true';
}
