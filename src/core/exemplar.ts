// # exemplar.js
import { isUint8Array } from 'uint8array-extras';
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import FileType from './file-types.js';
import LotObject, { type LotObjectArray } from './lot-object.js';
import { ExemplarProperty, kPropertyType } from './exemplar-properties.js';
import { hex, inspect } from 'sc4/utils';
import { kFileType } from './symbols.js';
import type { byte, float, sint32, sint64, TGIArray, TGILike, uint16, uint32 } from 'sc4/types';
import {
	isKey,
    type Primitive,
    type Value,
    type Key,
    type NumberLike,
    type PropertyValueType,
    type ValueType,
} from './exemplar-properties-types.js';
import parseStringExemplar from './parse-string-exemplar.js';
import type { Class } from 'type-fest';
import TGI from './tgi.js';

type ExemplarId = 'EQZB1###' | 'EQZT1###' | 'CQZB1###' | 'CQZT###';

export type ExemplarLike = {
	get<K extends Key = Key>(key: K): Value<K> | undefined;
};

export type ExemplarOptions = {
	id?: ExemplarId;
	parent?: TGILike;
	properties?: Property[] | PropertyOptions[];
};
export type PropertyOptions<K extends Key = Key> = {
	id: number;
	type?: PropertyValueType;
	value: Value<K>;
	comment?: string;
};

type AddPropertyOptions<K extends Key = Key> = {
	id: K;
	value: Value<K>
	type?: PropertyValueType;
};

type ExemplarJSON = {
	parent: TGIArray;
	properties: ExemplarPropertyJSON[];
};

type ExemplarPropertyJSON = {
	id: number;
	name?: string;
	value: any;
};

const LotObjectRange = [
	+ExemplarProperty.LotConfigPropertyLotObject,
	+ExemplarProperty.LotConfigPropertyLotObject+1279,
];

// Invert the exemplar properties so that we can find the name by id easily.
const idToName: Map<number, string> = new Map(
	Object.entries(ExemplarProperty).map(([name, object]) => {
		return [+(object as NumberLike), name as string];
	}),
);
let config = +ExemplarProperty.LotConfigPropertyLotObject;
for (let i = 1; i < 1280; i++) {
	idToName.set(config+i, 'LotConfigPropertyLotObject');
}

type ITypeInfo = {
	hex: number;
	bytes: number;
	read: (rs: Stream, length?: number) => Value;
	write: (buff: WriteBuffer, value: Value, length?: number) => void,
};

const TypeInfo: Record<PropertyValueType, ITypeInfo> = {
	Uint8: {
		hex: 0x100 as const,
		bytes: 1,
		read: (rs: Stream) => rs.uint8(),
		write: (buff: WriteBuffer, value: byte) => buff.writeUInt8(value),
	},
	Uint16: {
		hex: 0x200 as const,
		bytes: 2,
		read: (rs: Stream) => rs.uint16(),
		write: (buff: WriteBuffer, value: uint16) => buff.writeUInt16LE(value),
	},
	Uint32: {
		hex: 0x300 as const,
		bytes: 4,
		read: (rs: Stream) => rs.uint32(),
		write: (buff: WriteBuffer, value: uint32) => buff.writeUInt32LE(value),
	},
	Sint32: {
		hex: 0x700 as const,
		bytes: 4,
		read: (rs: Stream) => rs.int32(),
		write: (buff: WriteBuffer, value: sint32) => buff.writeInt32LE(value),
	},
	Sint64: {
		hex: 0x800 as const,
		bytes: 8,
		read: (rs: Stream) => rs.bigint64(),
		write: (buff: WriteBuffer, value: sint64) => buff.writeBigInt64LE(value),
	},
	Float32: {
		hex: 0x900 as const,
		bytes: 4,
		read: (rs: Stream) => rs.float(),
		write: (buff: WriteBuffer, value: float) => buff.writeFloatLE(value),
	},
	Bool: {
		hex: 0xb00 as const,
		bytes: 1,
		read: (rs: Stream) => Boolean(rs.uint8()),
		write: (buff: WriteBuffer, value: boolean) => buff.writeUInt8(Number(value)),
	},
	String: {
		hex: 0xc00 as const,
		bytes: 1,
		read: (rs: Stream, length: number) => rs.string(length),
		write: (buff: WriteBuffer, str: string) => buff.string(str),
	},
};
const HEX_TO_TYPE: Record<string, PropertyValueType> = Object.fromEntries(
	Object.entries(TypeInfo)
		.map(([type, { hex }]) => [hex, type as PropertyValueType]),
);

// # Exemplar()
// See https://www.wiki.sc4devotion.com/index.php?title=EXMP for the spec.
abstract class BaseExemplar {
	id: ExemplarId = 'EQZB1###';
	parent: TGI;
	properties: Property[] = [];
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
		this.parent = new TGI(data.parent || [0, 0, 0]);
		this.properties = [...data.properties || []].map(def => {
			return (isClone || !(def instanceof Property) ?
				new Property(def) :
				def as Property
			);
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
		yield* this.properties;
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
		let i = +ExemplarProperty.LotConfigPropertyLotObject;
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
	prop<K extends Key>(key: K): Property<K> | undefined {
		let id = normalizeId(key);
		return this.#table.get(id);
	}

	// ## value(key)
	// Helper function for directly accessing the value of a property. We also 
	// provide some syntactic sugar here over getting the *raw* property. If the 
	// property is an array, but it was not stored like that in the exemplar 
	// properties, then we'll automatically unwrap so that we always work with 
	// the correct data format when using known values!
	value<K extends Key>(key: K): Value<K> | undefined {
		let prop = this.prop(key);
		if (!prop) return undefined;
		return prop.getSafeValue();
	}

	// ## get(key)
	// Alias for `value(key)`
	get<K extends Key>(key: K): Value<K> | undefined {
		return this.value(key);
	}

	// ## set(key, value)
	// Updates the value of a rop by key.
	set<K extends Key>(key: K, value: Value<K>): this {
		let prop = this.prop(key);
		if (prop) {
			prop.value = value;
		}
		return this;
	}

	// ## addProperty(id, value, typeHint)
	// Adds a property to the exemplar file. Note that we automatically use 
	// Uint32 as a default for numbers, but this can obviously be set to 
	// something specific.
	addProperty<K extends Key>(idOrName: K, value: Value<K>, typeHint?: PropertyValueType): Property<K>;
	addProperty<K extends Key>(propOptions: AddPropertyOptions<K>): Property<K>;
	addProperty<K extends Key>(
		idOrPropOptions: K | AddPropertyOptions<K>,
		value?: Value<K>,
		typeHint: PropertyValueType = 'Uint32',
	): Property<K> {
		let options: PropertyOptions<K>;
		if (isKey(idOrPropOptions)) {
			if (typeof value === 'undefined') {
				throw new TypeError(`You must specify a value for a property!`);
			}
			let id = normalizeId(idOrPropOptions);
			let type = normalizeType(id, value, typeHint);
			options = { id, value, type };
		} else {
			let { id, ...rest } = idOrPropOptions as AddPropertyOptions<K>;
			options = {
				id: normalizeId(id),
				...rest,
			};
		}
		let prop = new Property<K>(options);
		this.properties.push(prop);
		this.#table.set(prop.id, prop);
		return prop;
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
		this.parent = rs.tgi();

		// Read all properties one by one. Note: apparently it's possible that 
		// an exemplar contains an incorrect "count". If that's the case, we 
		// should handle this gracefully, so we always check for any remaining 
		// bytes first.
		const count = rs.uint32();
		const props = this.properties = new Array(count);
		for (let i = 0; i < count; i++) {
			if (rs.remaining() < 4) {
				console.warn(`Corrupt examplar detected! Property count of the exemplar is larger than the actual amount!`);
				props.length = i;
				break;
			}
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
		this.parent = new TGI(obj.parent);
		this.properties = obj.properties.map(def => {
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
		for (let prop of this.properties) {
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
		let { properties: props } = this;
		if (this.#lotObjects) {
			let [min, max] = LotObjectRange;
			props = props.filter(prop => {
				return !(min <= prop.id && prop.id <= max);
			});
			let i = +ExemplarProperty.LotConfigPropertyLotObject;
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

	// ## toJSON()
	// Serializes the exemplar as json. Note that the json might actually 
	// include Bigints as well, so it's not pure json, but yaml is able to 
	// handle this properly.
	toJSON(): ExemplarJSON {
		return {
			parent: [...this.parent] as TGIArray,
			properties: this.properties.map(prop => {
				let { name } = prop;
				return {
					id: prop.id,
					...(name ? { name } : null),
					type: prop.type,
					value: prop.value,
				};
			}),
		};
	}

}

// # normalaizeId(idOrName)
// Looks up the *numeric* property id, but also allows looking up by name.
function normalizeId(idOrName: NumberLike | string): number {
	if (typeof idOrName === 'string') {
		if (idOrName in ExemplarProperty) {
			return +ExemplarProperty[idOrName as keyof typeof ExemplarProperty];
		} else {
			throw new Error(`Unknown exemplar property name ${idOrName}!`);
		}
	} else {
		return +idOrName;
	}
}

// # normalizeType(id, value, typeHint)
// Tries to figure out the type of this property in an intelligent way. We first 
// check whether the id is a known id. If that's the case, then we know the type 
// right away. Otherwise we try to derive it from the value, and as a last 
// resort we rely on the type hint, which defaults to uint32.
function normalizeType(
	id: number,
	value: Value,
	typeHint: PropertyValueType = 'Uint32',
): PropertyValueType {
	let name = idToName.get(id);
	if (name && name in ExemplarProperty) {
		let object = ExemplarProperty[name as keyof typeof ExemplarProperty];
		if (typeof object === 'number') return 'Uint32';
		let [type] = [object[kPropertyType]].flat();
		return type;
	}

	// The property is not a known property, so we're in uncharted territory. 
	// Now check if we can figure out the type from the value itself.
	if (typeof value === 'string') return 'String';
	let [first] = [value].flat();
	if (typeof first === 'boolean') return 'Bool';
	else if (typeof first === 'bigint') return 'Sint64';
	else return typeHint;

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
class Property<K extends Key = Key> {
	id = 0x00000000;
	type: PropertyValueType = 'Uint32';
	value: Value<K> | undefined;

	// ## constructor({ id, type, value } = {})
	// If the data passed is a property, then we'll use a *clone* strategy.
	constructor(data?: PropertyOptions<K> | Property<K>) {
		let isClone = data instanceof Property;
		let { id = 0, type = getTypeFromId(id), value } = data || {};
		this.id = +id;
		this.type = type;
		this.value = value !== undefined ? cast(
			type,
			isClone ? structuredClone(value as ValueType) : value as ValueType
		) as Value<K> : undefined;
	}

	// ## getSafeValue()
	// This function handles the fact that sometimes a property can be stored as 
	// an array, while the schema as defined in new_properties.xml actually 
	// defines the property as a single-value property and vice versa. This can
	// lead to runtime errors, so it is advised to use `getSafeValue()` instead 
	// as this performs the required checks. Also note that TypeScript can't 
	// really help us here: it's a runtime issue!
	getSafeValue(): Value<K> | undefined {
		let { name, value } = this;
		if (name && value !== undefined) {
			let info = ExemplarProperty[name as keyof typeof ExemplarProperty];
			let shouldBeArray = typeof info !== 'number' && Array.isArray(
				info[kPropertyType as keyof typeof info],
			);

			// Note: we use any below because TypeScript knows that somethings 
			// wrong if this happens - which is indeed the case! However, there 
			// is no runtime guarantee for this, so our runtime correction is 
			// labeled as invalid by TypeScript. "any" to the rescue.
			let isArray = Array.isArray(value);
			if (shouldBeArray && !isArray) {
				return [value] as Value<K>;
			} else if (!shouldBeArray && isArray) {
				return (value as any)[0] as Value<K>;
			} else {
				return value;
			}

		} else {
			return value;
		}
	}

	// ## get name()
	get name() {
		return idToName.get(this.id) ?? '';
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
		return TypeInfo[this.type].hex;
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
		let { bytes } = TypeInfo[type];
		return this.multiple ? (4 + (value as any[]).length * bytes) : bytes;
	}

	// ## parse(rs)
	// Parses the property from a buffer wrapped up in a stream object that 
	// allows for easier reading.
	parse(rs: Stream) {

		// Parse value type & associated reader.
		this.id = rs.uint32();
		let nr = rs.uint16();
		let type = this.type = HEX_TO_TYPE[nr] as PropertyValueType;
		let { read } = TypeInfo[type];

		// Parse key type.
		let keyType = rs.uint16();

		if (keyType === 0) {
			void rs.uint8();
			this.value = read(rs) as Value<K>;
		} else if (keyType === 0x80) {
			void rs.uint8();
			let reps = rs.uint32();

			// If we're dealing with a string, read the string. Otherwise 
			// read the values using the repetitions. Note that this means 
			// that strings can't be repeated!
			// Note: the "as Value<K>" expressions are needed because TypeScript 
			// doesn't have access to runtime information. This means that it 
			// can't guarantee us that Value<K> can hold a string at runtime 
			// because it might just as well evaluate to int32[] or something. 
			// Hence using "as" is justified here.
			if (type === 'String') {
				this.value = rs.string(reps) as Value<K>;
			} else {
				let values: Primitive[] = [];
				for (let i = 0; i < reps; i++) {
					values.push(read(rs) as Primitive);
				}
				this.value = values as Value<K>;
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
			const { write } = TypeInfo[type];
			if (Array.isArray(value)) {
				buff.writeUInt32LE(value.length);
				for (let entry of value) {
					write(buff, entry);
				}
			} else {
				write(buff, value!);
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
			case 'Uint8':
			case 'Uint16':
			case 'Uint32':
				tf = (x: any) => inspect.hex(x);
		}
		if (value !== undefined) {
			value = Array.isArray(value) ? value.map(tf) : tf(value);
		}
		return {
			id: inspect.hex(this.id),
			name: this.name,
			type,
			value,
		};
	}

}

// # cast(type, value)
// Ensures a value specified for a property matches its specified type.
function cast(type: PropertyValueType, value: ValueType): ValueType {
	if (typeof value === 'undefined') return value;
	if (Array.isArray(value)) {
		return value.map(value => cast(type, value)) as Primitive[];
	}
	switch (type) {
		case 'String': return String(value);
		case 'Bool': return Boolean(value);
		case 'Sint64': return BigInt(value);
		default: return Number(value);
	}
}

// # getTypeFromId()
function getTypeFromId(id: number): PropertyValueType {
	let name = idToName.get(id);
	if (name !== undefined) {
		let info = ExemplarProperty[name as keyof typeof ExemplarProperty];
		if (typeof info === 'number') return 'Uint32';
		let type = info[kPropertyType];
		return Array.isArray(type) ? type[0] : type;
	}
	return 'Uint32';
}
