// # exemplar.js
import { isUint8Array } from 'uint8array-extras';
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import NAMES from './exemplar-props.js';
import FileType from './file-types.js';
import LotObject, { type LotObjectArray } from './lot-object.js';
import { ExemplarProperty } from './enums.js';
import { invertMap, hex, inspect } from 'sc4/utils';
import { kFileType } from './symbols.js';
import type { byte, float, sint32, sint64, TGIArray, uint16, uint32, uint8 } from 'sc4/types';
import parseStringExemplar from './parse-string-exemplar.js';
import type { Class } from 'type-fest';

type ExemplarId = 'EQZB1###' | 'EQZT1###' | 'CQZB1###' | 'CQZT###';
type PropertyValueType =
 	| typeof Uint8Array
 	| typeof Uint16Array
 	| typeof Uint32Array
 	| typeof Int32Array
 	| typeof BigInt64Array
 	| typeof Float32Array
 	| typeof Boolean
 	| typeof String;

type PropertyPrimitive = uint8 | uint16 | uint32 | sint32 | float | boolean;
export type PropertyValue = string | PropertyPrimitive | PropertyPrimitive[];

export type ExemplarOptions = {
	id?: ExemplarId;
	parent?: TGIArray;
	props?: Property[] | PropertyOptions[];
};
export type PropertyOptions = {
	id: number;
	type?: PropertyValueType;
	value: PropertyValue;
	comment?: string;
};

const LotObjectRange = [
	ExemplarProperty.LotConfigPropertyLotObject,
	ExemplarProperty.LotConfigPropertyLotObject+1279,
];

// We no longer use an enum for indicating the type of an exemplar property. 
// Instead we use the native built-in JavaScript typed arrays to indicate the 
// type of a property, as there is no "Uint32" *type* in JavaScript. To make it 
// a bit more readable though, we'll create aliases because Uint32Array might 
// indicate that the type *has* to be an array, but that is not the case 
// actually. It onl indicates that the *values* are Uint32!s
const Uint8 = Uint8Array;
const Uint16 = Uint16Array;
const Uint32 = Uint32Array;
const Sint32 = Int32Array;
const Sint64 = globalThis.BigInt64Array;
const Float32 = Float32Array;
const Bool = Boolean;

const TYPE_TO_HEX = new Map<PropertyValueType, number>([
	[Uint8, 0x100],
	[Uint16, 0x200],
	[Uint32, 0x300],
	[Sint32, 0x700],
	[Sint64, 0x800],
	[Float32, 0x900],
	[Bool, 0xB00],
	[String, 0xc00],
]);
const HEX_TO_TYPE = invertMap(TYPE_TO_HEX);

function getByteLengthFromType(type: PropertyValueType) {
	if ('BYTES_PER_ELEMENT' in type) {
		return type.BYTES_PER_ELEMENT;
	} else {
		return 1;
	}
}

const VALUE_READERS = new Map<PropertyValueType, Function>([
	[Uint8, (rs: Stream) => rs.uint8()],
	[Uint16, (rs: Stream) => rs.uint16()],
	[Uint32, (rs: Stream) => rs.uint32()],
	[Sint32, (rs: Stream) => rs.int32()],
	[Sint64, (rs: Stream) => rs.bigint64()],
	[Float32, (rs: Stream) => rs.float()],
	[Bool, (rs: Stream) => Boolean(rs.uint8())],
	[String, (rs: Stream, length: number) => rs.string(length)],
]);

const VALUE_WRITERS = new Map<PropertyValueType, Function>([
	[Uint8, (buff: WriteBuffer, value: byte) => buff.writeUInt8(value)],
	[Uint16, (buff: WriteBuffer, value: uint16) => buff.writeUInt16LE(value)],
	[Uint32, (buff: WriteBuffer, value: uint32) => buff.writeUInt32LE(value)],
	[Sint32, (buff: WriteBuffer, value: sint32) => buff.writeInt32LE(value)],
	[Sint64, (buff: WriteBuffer, value: sint64) => buff.writeBigInt64LE(value)],
	[Float32, (buff: WriteBuffer, value: float) => buff.writeFloatLE(value)],
	[Bool, (buff: WriteBuffer, value: boolean) => buff.writeUInt8(Number(value))],
	[String, (buff: WriteBuffer, str: string) => buff.string(str)],
]);

// # Exemplar()
// See https://www.wiki.sc4devotion.com/index.php?title=EXMP for the spec.
abstract class BaseExemplar {
	id: ExemplarId = 'EQZB1###';
	parent: TGIArray = [0, 0, 0];
	props: Property[] = [];
	#lotObjects: LotObject[];
	#table: Map<number, Property> = new Map();

	// ## constructor(data = {})
	// Creates a new exemplar. Note that this should support copy-constructing.
	constructor(data: ExemplarOptions | Uint8Array = {}) {
		if (isUint8Array(data)) {
			this.parse(data);
			return;
		}
		const isClone = data instanceof this.constructor;
		this.id = data.id || 'EQZB1###';
		this.parent = data.parent || [0, 0, 0];
		this.props = [...data.props || []].map(def => {
			return isClone ? new Property(def) : def as Property;
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
		const Constructor = this.constructor as Class<BaseExemplar>;
		return new Constructor(this);
	}

	// ## get fileType()
	get fileType() {
		return FileType.Exemplar;
	}

	// ## *[Symbol.iterator]()
	*[Symbol.iterator]() {
		yield* this.props;
	}

	// ## get lotObjects()
	// Returns a list of all LotConfigPropertyLotObject properties in the 
	// exemplar. They always start at 0x88EDC900 and then continue one by one. 
	// Note that we don't parse them right away because parsing them might be 
	// expensive, so we'll only parse them "just in time". Once they are parsed, 
	// we'll use the objects instead of the raw values in the properties!
	get lotObjects() {
		if (this.#lotObjects) return this.#lotObjects;
		const table = this.#table;
		let i = ExemplarProperty.LotConfigPropertyLotObject;
		let out = [];
		let entry = table.get(i);
		while (entry) {
			out.push(new LotObject(entry.value as LotObjectArray));
			entry = table.get(++i);
		}
		this.#lotObjects = out;
		return out;
	}

	// ## set lotObjects()
	// Sets the lot objects. Can be useful to clear a lot of all objects.
	set lotObjects(lotObjects) {
		this.#lotObjects = lotObjects;
	}

	// ## prop(key)
	// Helper function for accessing a property.
	prop(key: number): Property | undefined {
		return this.#table.get(key);
	}

	// ## value(key)
	// Helper function for directly accessing the value of a property.
	value(key: number) {
		let prop = this.prop(key);
		return prop ? prop.value : undefined;
	}

	// ## get(key)
	// Alias for `value(key)`
	get(key: number) {
		return this.value(key);
	}

	// ## set(key, value)
	// Updates the value of a rop by key.
	set(key: number, value: PropertyValue) {
		let prop = this.prop(key);
		if (prop) {
			prop.value = value;
		}
		return this;
	}

	// ## singleValue(key)
	// Ensures that the value return is never an array. This is to handle cases 
	// where properties that normally shouldn't be arrays, are still stored as 
	// 1-element arrays in an examplar,
	singleValue(key: number): string | PropertyPrimitive | undefined {
		let value = this.value(key);
		return Array.isArray(value) ? value[0] : value;
	}

	// ## addProperty(id, value, typeHint)
	// Adds a property to the exemplar file. Note that we automatically use 
	// Uint32 as a default for numbers, but this can obviously be set to 
	// something specific.
	addProperty(
		id: number,
		value: PropertyValue,
		typeHint: PropertyValueType = Uint32,
	) {
		let type;
		if (typeof value === 'string') {
			type = String;
		} else if (typeof value === 'bigint') {
			type = BigInt64Array;
		} else if (typeof value === 'boolean') {
			type = Boolean;
		} else {
			type = typeHint;
		}
		let prop = new Property({
			id,
			type,
			value,
		});
		this.props.push(prop);
		this.#table.set(prop.id, prop);
	}

	// ## parse(bufferOrStream)
	// Parses an exemplar file from a buffer.
	parse(bufferOrStream: Stream | Uint8Array) {

		const rs = new Stream(bufferOrStream);
		let id = this.id = rs.string(8) as ExemplarId;

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
		this.#table = Object.create(null);
		for (let i = 0; i < count; i++) {
			let prop = props[i] = new Property();
			prop.parse(rs);
		}

		// Create the property table as well.
		this.createTable();

		return this;

	}

	// ## parseFromString(str)
	parseFromString(str: string) {
		let obj = parseStringExemplar(str);
		this.parent = obj.parent;
		this.props = obj.props.map(def => {
			return new Property({
				id: def.id,
				type: def.type,
				value: def.value,
			});
		});

		// Create the property table as well.
		this.createTable();
		return this;
	}

	// ## createTable()
	createTable() {
		const table = this.#table = new Map();
		for (let prop of this.props) {
			table.set(prop.id, prop);
		}
		return this;
	}

	// ## toBuffer()
	// Serializes the exemplar file into an uncompressed buffer. Can be used 
	// to save dbpf files again.
	toBuffer() {

		// Initialze the buffer.
		let buffer = new WriteBuffer();

		// Write away the id, but only use the binary format for now, so 
		// ensure the 4th byte is the character B.
		buffer.writeString(this.id);
		buffer.writeString('B', 3);
		for (let tgi of this.parent) {
			buffer.writeUInt32LE(tgi);
		}

		// IMPORTANT! If the lot objects have been parsed, then we have to 
		// filter them out from our raw props.
		let { props } = this;
		if (this.#lotObjects) {
			let [min, max] = LotObjectRange;
			props = props.filter(prop => {
				return !(min <= prop.id && prop.id <= max);
			});
			let i = ExemplarProperty.LotConfigPropertyLotObject;
			for (let lotObject of this.#lotObjects) {
				let prop = new Property({
					id: i++,
					value: lotObject.toArray(),
				});
				props.push(prop);
			}
		}

		// Write all properties to the buffer as well. Note that writing 
		// arrays is handled automatically.
		buffer.array(props);
		return buffer.toUint8Array();

	}

}

// # Exemplar
export class Exemplar extends BaseExemplar {
	static [kFileType] = FileType.Exemplar;
	id: ExemplarId = 'EQZB1###';
}

// # Cohort
// A cohort is a specific kind of exemplar. There are no differences, except for 
// the type id and the id field.
export class Cohort extends BaseExemplar {
	static [kFileType] = FileType.Cohort;
	id: ExemplarId = 'CQZB1###';
}

// # Property()
// Wrapper class around an Exemplar property.
class Property {
	id = 0x00000000;
	type: PropertyValueType = Uint32Array;
	value: PropertyValue | undefined;

	// ## constructor({ id, type, value } = {})
	// If the data passed is a property, then we'll use a *clone* strategy.
	constructor(data?: PropertyOptions | Property) {
		let isClone = data instanceof Property;
		let { id = 0, type = Uint32Array, value } = data || {};
		this.id = +id;
		this.type = type;
		this.value = isClone ? structuredClone(value) : value;
	}

	// ## get name()
	get name() {
		return NAMES[this.id] ?? '';
	}

	// ## [Symbol.toPrimitive]()
	// Casting the prop to a number will return the numeric value.
	[Symbol.toPrimitive](hint: string) {
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
	get hexType(): number {
		return TYPE_TO_HEX.get(this.type) as number;
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
		let bytes = getByteLengthFromType(type);
		return this.multiple ? (4 + (value as PropertyValue[]).length * bytes) : bytes;
	}

	// ## parse(rs)
	// Parses the property from a buffer wrapped up in a stream object that 
	// allows for easier reading.
	parse(rs: Stream) {

		// Parse value type & associated reader.
		this.id = rs.uint32();
		let nr = rs.uint16();
		let type = this.type = HEX_TO_TYPE.get(nr) as PropertyValueType;
		let reader = VALUE_READERS.get(type);

		// Parse key type.
		let keyType = rs.uint16();

		if (keyType === 0) {
			void rs.uint8();
			this.value = reader!(rs);
		} else if (keyType === 0x80) {
			void rs.uint8();
			let reps = rs.uint32();

			// If we're dealing with a string, read the string. Otherwise 
			// read the values using the repetitions. Note that this means 
			// that strings can't be repeated!
			if (type === String) {
				this.value = rs.string(reps);
			} else {
				let values = this.value = new Array(reps);
				for (let i = 0; i < reps; i++) {
					values[i] = reader!(rs) as PropertyPrimitive;
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
			const writer = VALUE_WRITERS.get(type);
			if (Array.isArray(value)) {
				buff.writeUInt32LE(value.length);
				for (let entry of value) {
					writer!(buff, entry);
				}
			} else {
				writer!(buff, value);
			}
		}
		return buff.toUint8Array();

	}

	// ## [Symbol.for('nodejs.util.inspect.custom')](depth, opts, inspect)
	// Allow custom inspection in Node.js
	[Symbol.for('nodejs.util.inspect.custom')]() {

		// The value to be inspected depends on the type.
		let { type, value } = this;
		let tf = (x: any) => x;
		switch (type) {
			case Uint8:
			case Uint16:
			case Uint32:
				tf = (x: any) => inspect.hex(x);
		}
		if (value !== undefined) {
			value = Array.isArray(value) ? value.map(tf) : tf(value);
		}
		return {
			id: inspect.hex(this.id),
			name: this.name,
			type: inspect.constructor(type),
			value,
		};
	}

}