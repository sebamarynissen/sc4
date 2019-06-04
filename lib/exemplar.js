// # exemplar.js
"use strict";
const Stream = require('./stream');
const NAMES = require('./exemplar-props');

const INT32 = 0x700;
const FLOAT = 0x900;
const UINT32 = 0x300;
const BOOL = 0xB00;
const BYTE = 0x100;
const BIGINT = 0x800;
const UINT16 = 0x200;
const STRING = 0xC00;

function Uint8(x) { return Number(x); }
function Uint16(x) { return Number(x); }
function Uint32(x) { return Number(x); }
function Int32(x) { return Number(x); }
function Float(x) { return Number(x); }

const VALUE_TYPES = {
	[BYTE]: Uint8,
	[UINT16]: Uint16,
	[UINT32]: Uint32,
	[INT32]: Int32,
	[BIGINT]: BigInt,
	[BOOL]: Boolean,
	[FLOAT]: Float,
	[STRING]: String
};

const VALUE_READERS = {
	[BYTE]: rs => rs.uint8(),
	[UINT16]: rs => rs.uint16(),
	[UINT32]: rs => rs.uint32(),
	[INT32]: rs => rs.int32(),
	[BIGINT]: rs => rs.bigint64(),
	[BOOL]: rs => Boolean(rs.uint8()),
	[FLOAT]: rs => rs.float(),
	[STRING]: (rs, length) => rs.string(length)
};

// # Exemplar()
// See https://www.wiki.sc4devotion.com/index.php?title=EXMP for the spec.
module.exports = class Exemplar {

	// ## constructor(buff)
	constructor(buff) {
		this.parse(buff);
	}

	// ## parse(buff)
	parse(buff) {

		const rs = new Stream(buff);
		rs.skip(8);

		// Get the parent cohort TGI. Set to 0 in case of no parent.
		let type = rs.uint32();
		let group = rs.uint32();
		let instance = rs.uint32();

		// Read all properties one by one.
		const count = rs.uint32();
		const props = this.props = new Array(count);
		for (let i = 0; i < count; i++) {
			let name = rs.uint32();
			let valueType = rs.uint16();
			let reader = VALUE_READERS[valueType];
			let keyType = rs.uint16();

			// Prepare the property. Only thing left that we need to fill in 
			// is the value.
			let prop = props[i] = {
				"name": name,
				// "hex": '0x'+name.toString(16).padStart(8, '0'),
				"string": NAMES[name],
				"valueType": VALUE_TYPES[valueType],
				"keyType": keyType,
				"value": null
			};

			if (keyType === 0) {
				let nr = rs.uint8();
				prop.value = reader(rs);
			} else if (keyType === 0x80) {
				let unused = rs.uint8();
				let reps = rs.uint32();

				// If we're dealing with a string, read the string. Otherwise 
				// read the values using the repetitions. Note that this means 
				// that strings can't be repeated!
				if (valueType === STRING) {
					prop.value = rs.string(reps);
					continue;
				}

				// Read in the repeated values.
				let values = prop.value = new Array(reps);
				for (let i = 0; i < reps; i++) {
					values[i] = reader(rs);
				}
			}

		}

	}

};