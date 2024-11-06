// # util.js
import path from 'node:path';

// Julian day offset between unix epoch and Julian Date 0.
const JULIAN_OFFSET = 2440587.5;
const MS_DAY = 60*60*24*1000;

// # getUnixFromJulian(d)
export function getUnixFromJulian(d) {
	return (d - JULIAN_OFFSET) * MS_DAY;
}

// # getJulianFromUnix(ms)
export function getJulianFromUnix(ms) {
	return ms/MS_DAY + JULIAN_OFFSET;
}

// # makeEnum(def)
// Helper function for creating an enum type using symbols. Inspired by how 
// TypeScript does it, but with symbols instead of numbers.
export function makeEnum(def) {
	let obj = {};
	for (let name of def) {
		obj[name] = Symbol(name);
	}
	return Object.freeze(obj);
}
export { makeEnum as enum };

// # invert(obj)
// Inverts an object in-place. Beware of keys that are present as values as 
// well!
export function invert(obj) {
	let out = Object.create(null);
	let keys = [
		...Object.getOwnPropertyNames(obj),
		...Object.getOwnPropertySymbols(obj),
	];
	for (let key of keys) {
		out[ obj[key] ] = key;
	}
	return out;
}

// # hex(nr, pad)
export function hex(nr, pad = 8) {
	return '0x'+(Number(nr).toString(16).padStart(pad, '0'));
}

// # split(buffer)
// Splits the given buffer that contains multiple "SIZE CRC MEM" records into 
// an array that contains the individual records. Note that we don't copy 
// buffers here, we're simply returnning buffer views on top of it.
export function split(buffer) {

	let offset = 0;
	let slices = [];
	while (offset < buffer.length) {
		let size = buffer.readUInt32LE(offset);
		let slice = Buffer.from(buffer.buffer, buffer.offset+offset, size);
		offset += size;
		slices.push(slice);
	}

	return slices;

}

// # chunk(format, str)
// Chunks the given string according to the given format. Useful when we need 
// to debug hex dumps.
export function chunk(format, str) {
	let out = [];
	for (let i = 0; i < format.length; i++) {
		let length = format[i];
		out.push(str.slice(0, length));
		str = str.slice(length);
	}
	out.push(str);
	return out.join(' ').trim();
}

// Utilty fundction for updating the string prototype.
chunk.register = function() {
	if (!String.prototype.chunk) {
		// eslint-disable-next-line no-extend-native
		String.prototype.chunk = function(format = []) {
			return chunk([...format, ...Array(100).fill(8)], this);
		};
	}
};

// # bin(nr)
export function bin(nr) {
	return '0b'+Number(nr).toString(2).padStart(8, '0');
}

// # tgi(type, group, id)
// Returns a tgi id for the given type, group & id. Used for uniquely 
// identifying files.
export function tgi(type, group, id) {
	return [type, group, id].map(hex).join('-');
}

// # getClassType(object)
// Inspects the object and returns its Type ID. If a class constructor is 
// specified, we hence return the type id of this constructor, if it's an 
// instance we look it up in the constructor.
const hType = Symbol.for('sc4.type');
export function getClassType(object) {
	if (typeof object === 'function') return object[hType];
	else return object[hType] || object.constructor[hType];
}

// # getCityPath(city, region)
// Helper function that easily gets the path of the given city in the given 
// region. Note that we automatically prefix with "City - " and postfix with 
// ".sc4".
export function getCityPath(city, region = 'Experiments') {
	let file = `City - ${city}.sc4`;
	return path.resolve(
		process.env.USERPROFILE,
		'documents/SimCity 4/Regions',
		region,
		file,
	);
}
