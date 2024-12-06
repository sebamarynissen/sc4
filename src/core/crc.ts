// # crc.ts
import table from './crc-table.js';
const IV = 0xffffffff;
const MAX = 250000;

// # crc(buffer, offset = 0)
export default function crc(buffer: Uint8Array, offset: number = 0) {

	// It's possible that an offset was given for the CRC so we can discard 
	// the SIZE CRC part easily.
	let input = offset > 0 ? buffer.subarray(offset) : buffer;

	// See #4. Apparently the game doesn't calculate crcs for buffers larger 
	// than 250 000 bytes. It cuts them off, so we'll clamp the crc to it.
	const size = Math.min(MAX, input.length);

	// Now perform the *actual* checksum algorithm on the capped buffer.
	return crc32(input, size);

}

// Given that JS performs bitwise operators on *signed* integers, we need a 
// way to interpret signed integers as unsigned ones, which is what this 
// function does.
const intArray = new Int32Array(1);
const uintArray = new Uint32Array(intArray.buffer);
function uint(x: number): number {
	intArray[0] = x;
	return uintArray[0];
}

// # crc32(buffer, buffer.length, iv = 0xffffffff)
// The JS implementation of the crc checksum algorithm. The key difference 
// here is that JS uses *signed* integers for bitwise operations. This means 
// that we have to do two things:
//   1. Cast the index to look for in the table to an unsigned integer because 
//      negative indices are obviously not possible.
//   2. Cast the result to an unsigned integer.
function crc32(
	buffer: Uint8Array,
	length: number = buffer.length,
	iv: number = IV,
) {
	let crc = iv;
	for (let i = 0; i < length; i++) {
		let index = uint(((crc >> 24) ^ buffer[i]) & 0xff);
		crc = (crc << 8) ^ table[index];
	}
	return uint(crc);
}
