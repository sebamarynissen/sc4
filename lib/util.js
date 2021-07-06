// # util.js
'use strict';
const path = require('path');

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

// # typeDecorator(type)
// Returns a function that decorates the given class with the given type id. 
// The idea is that this can be used when ES7 decorators become available!
function typeDecorator(type) {
	return function typeDecorator(klass) {
		let desc;
		Object.defineProperty(klass, 'type', desc = {
			"value": type,
			"enumerable": false,
			"writable": false,
			"configurable": false
		});
		Object.defineProperty(klass, 'id', desc);
		Object.defineProperty(klass.prototype, 'type', desc);
		return klass;
	};
}
exports.typeDecorator = typeDecorator;

// # getCityPath(city, region)
// Helper function that easily gets the path of the given city in the given 
// region. Note that we automatically prefix with "City - " and postfix with 
// ".sc4".
function getCityPath(city, region = 'Experiments') {
	let file = `City - ${city}.sc4`;
	return path.resolve(
		process.env.USERPROFILE,
		'documents/SimCity 4/Regions',
		region,
		file,
	);
}
exports.getCityPath = getCityPath;

// # getTestFile(file)
// Helper function that easily gets the path of a given test file in the test 
// folder.
function getTestFile(file) {
	return path.resolve(
		__dirname,
		'../test/files',
		file,
	);
}
exports.getTestFile = getTestFile;
