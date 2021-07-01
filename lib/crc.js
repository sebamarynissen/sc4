// # crc.js
'use strict';
const table = require('./crc-table.js');
const lib = require('./lib-cpp.js');
const IV = 0xffffffff;
const MAX = 250000;

// Determine what implementation we're going to use at runtime: C++ if it's 
// available (it's supposed to be faster), otherwise we'll use the JS 
// implementation (such as when we're in the browser).
const sum = (lib && lib.crc) || js;

// # crc(buffer, offset = 0, iv = 0xffffffff)
function crc(buffer, offset = 0, iv = IV) {

	// It's possible that an offset was given for the CRC so we can discard 
	// the SIZE CRC part easily.
	let input = offset > 0 ? buffer.slice(offset) : buffer;

	// See #4. Apparently the game doesn't calculate crcs for buffers larger 
	// than 250 000 bytes. It cuts them off, so we'll clamp the crc to it.
	const size = Math.min(MAX, input.length);

	// Use the C++ implentation if available (it's faster), and if not we'll 
	// rely on the JS implementation.
	return sum(input, size, iv);

}
module.exports = crc;

// Given that JS performs bitwise operators on *signed* integers, we need a 
// way to interpret signed integers as unsigned ones, which is what this 
// function does.
const intArray = new Int32Array(1);
const uintArray = new Uint32Array(intArray.buffer);
function uint(x) {
	intArray[0] = x;
	return uintArray[0];
}

// # js(buffer, buffer.length, iv = 0xffffffff)
// The JS implementation of the crc checksum algorithm. The key difference 
// here is that JS uses *signed* integers for bitwise operations. This means 
// that we have to do two things:
//   1. Cast the index to look for in the table to an unsigned integer because 
//      negative indices are obviously not possible.
//   2. Cast the result to an unsigned integer.
function js(buffer, length = buffer.length, iv = IV) {
	let crc = iv;
	for (let i = 0; i < length; i++) {
		let index = uint(((crc >> 24) ^ buffer[i]) & 0xff);
		crc = (crc << 8) ^ table[index];
	}
	return uint(crc);
}
