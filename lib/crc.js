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

// # crc(buff, offset, iv)
function crc(buff, offset, iv = IV) {
	if (offset) {
		let start = buff.offset+offset;
		let length = buff.byteLength - offset;
		buff = Buffer.from(buff.buffer, start, length);
	}

	// See #4. Apparently the game doesn't calculate crcs for buffers larger 
	// than 250 000 bytes. It cuts them off.
	if (buff.byteLength > MAX) {
		buff = Buffer.from(buff.buffer, buff.offset, MAX);
	}

	// Use the C++ implentation if available (it's faster), and if not we'll 
	// rely on the JS implementation.
	return sum(buff, buff.byteLength, iv);

}
module.exports = crc;

// Given that JS performs bitwise operators on *signed* integers, we need a way 
// to interpret signed integers as unsigned ones, which is what this function 
// does.
const intArray = new Int32Array(1);
const uintArray = new Uint32Array(intArray.buffer);
function uint(x) {
	intArray[0] = x;
	return uintArray[0];
}

// # js(buffer, buffer.length, iv = 0xffffffff)
// The JS implementation of the crc checksum algorithm. The key difference here 
// is that JS uses *signed* integers for bitwise operations. This means that we 
// have to do two things:
//   1. Cast the index to look for in the table to an unsigned integer because 
//      negative indices are obviously not possible.
//   2. Cast the result to an unsigned integer.
function js(buffer, length = buffer.length, iv = 0xffffffff) {
	let crc = iv;
	for (let i = 0; i < length; i++) {
		let index = uint(((crc >> 24) ^ buffer[i]) & 0xff);
		crc = (crc << 8) ^ table[index];
	}
	return uint(crc);
}
