import type { TGIArray } from 'sc4/types';
import type { PropertyOptions } from './exemplar.js';
import type { ExemplarPropertyValue } from './exemplar-properties-types.js';

type TypeIndicator =
	| 'String'
	| 'Uint32'
	| 'Uint16'
	| 'Uint8'
	| 'Float32'
	| 'Sint64'
	| 'Sint32'
	| 'Bool';

let val: string;
export default function parseStringExemplar(str: string) {
	val = str;

	// Read the parent cohort.
	until('ParentCohort'); ws();
	until('='); ws();
	until(':'); ws();

	let parent = [readHex(), readHex(), readHex()] as TGIArray;

	// Next hex we find is the prop count.
	const propCount = readHex() as number;
	until('\n');

	let props: PropertyOptions[] = [];
	for (let i = 0; i < propCount; i++) {
		props.push(readProp());
	}

	return {
		parent,
		props,
	};

}

function advance(n: number) {
	val = val.slice(n);
}

function until(token: string) {
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
	advance(match.index!+match[0].length);
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

	let id = readHex() as number;
	until(':');

	// Read a potential comment.
	ws();
	let comment = readComment();

	// Read the values.
	until('=');

	// Read the type.
	index = val.indexOf(':');
	let typeHint = val.slice(0, index) as TypeIndicator;
	advance(index+1);

	// Read the resp.
	index = val.indexOf(':');
	let reps = Number(val.slice(0, index));
	advance(index+1);

	let value = readValue(typeHint, reps) as ExemplarPropertyValue;

	// Restore.
	val = temp;

	// Consume trailing whitespace.
	ws();

	// Convert the string type to an actual type hint used by the prop.
	let type = ({
		Uint8: Uint8Array,
		Uint16: Uint16Array,
		Uint32: Uint32Array,
		Sint32: Int32Array,
		Sint64: BigInt64Array,
		Float32: Float32Array,
		Bool: Boolean,
		String,
	})[typeHint];
	return { id, comment, type, value };

}

const commentRegex = /^{"(.*)"}/;
function readComment() {
	let match = val.match(commentRegex);
	if (!match) return;
	return match[1];
}

const stringRegex = /{"(.*)"}/;
function readValue(type: TypeIndicator, reps: number) {
	if (type === 'String') {
		let match = val.match(stringRegex);
		if (!match) return '';
		advance(match.index!+match[0].length);
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

function readSingleValue(type: TypeIndicator) {
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
function readFloat() {
	let match = val.match(floatRegex);
	if (!match) return undefined;
	advance(match.index! + match[0].length);
	return Number(match[1]);
}

function readInt32() {
	let hex = readHexString();
	if (hex === undefined) return undefined;
	return Number(hex);
}

function readBigInt() {
	let hex = readHexString();
	if (hex === undefined) return undefined;
	if (typeof BigInt === 'undefined') {
		throw new Error('Your platform does not support the BigInt primitive!');
	}
	return BigInt(hex);

}

const boolRegex = /(true|false)/i;
function readBoolean() {
	let match = val.match(boolRegex);
	if (!match) return undefined;
	advance(match.index! + match[0].length);
	return String(match[0]).toLowerCase() === 'true';
}
