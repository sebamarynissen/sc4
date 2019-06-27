// # util.js
"use strict";

// # makeEnum(def)
// Helper function for creating an enum type using symbols. Inspired by how 
// TypeScript does it, but with symbols instead of numbers.
function makeEnum(def) {
	let obj = {};
	for (let name of def) {
		obj[name] = Symbol(name);
	}
	return Object.freeze(obj);
}
exports.makeEnum = exports.enum = makeEnum;

// # invert(obj)
// Inverts an object in-place. Beware of keys that are present as values as 
// well!
function invert(obj) {
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
exports.invert = invert;

// # hex(nr, pad)
function hex(nr, pad = 8) {
	return '0x'+(Number(nr).toString(16).padStart(pad, '0'));
}
exports.hex = hex;

// # split(buffer)
// Splits the given buffer that contains multiple "SIZE CRC MEM" records into 
// an array that contains the individual records. Note that we don't copy 
// buffers here, we're simply returnning buffer views on top of it.
function split(buffer) {

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
exports.split = split;

// # chunk(format, str)
// Chunks the given string according to the given format. Useful when we need 
// to debug hex dumps.
function chunk(format, str) {
	let out = [];
	for (let i = 0; i < format.length; i++) {
		let length = format[i];
		out.push(str.slice(0, length));
		str = str.slice(length);
	}
	out.push(str);
	return out.join(' ');
}
exports.chunk = chunk;

// # bin(nr)
function bin(nr) {
	return '0b'+Number(nr).toString(2).padStart(8, '0');
}
exports.bin = bin;

// # tgi(type, group, id)
// Returns a tgi id for the given type, group & id. Used for uniquely 
// identifying files.
function tgi(type, group, id) {
	return [type, group, id].map(hex).join('-');
}
exports.tgi = tgi;