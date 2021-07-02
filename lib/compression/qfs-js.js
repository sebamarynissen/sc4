// # qfs-js.js
// This file contains the JavaScript implementations of the QFS compression and 
// decompression algorithms. Can be used as an alternative to the native C++ 
// libraries, for example when running in the browser.
'use strict';
const { SmartBuffer } = require('smart-buffer');

// # decompress(input)
// JavaScript implementation of the QFS decompression algorithm.
function decompress(input) {

	// First two bytes are 0x10fb (QFS id), then follows the *uncompressed* 
	// size, which allows us to prepare a buffer for it.
	const size = 0x10000*input[2] + 0x100*input[3] + input[4];
	const out = Buffer.alloc(size, 0xff);

	// Start decoding now. Note that trialing bytes are handled separately, 
	// which is why we use the check `x < 0xfc`.
	let inpos = input[0] & 0x01 ? 8 : 5;
	let outpos = 0;
	while (inpos < input.length && input[inpos] < 0xfc) {
		let code = input[inpos];
		let a = input[inpos+1];
		let b = input[inpos+2];
		if (!(code & 0x80)) {
			let length = code & 3;
			memcpy(out, outpos, input, inpos+2, length);
			inpos += length+2;
			outpos += length;

			// Repeat data that is already in the output. This is the essence 
			// of the compression algorithm.
			length = ((code & 0x1c) >> 2) + 3;
			let offset = ((code >> 5) << 8) + a + 1;
			memcpy(out, outpos, out, outpos-offset, length);
			outpos += length;

		} else if (!(code & 0x40)) {
			let length = (a >> 6) & 3;
			memcpy(out, outpos, input, inpos+3, length);
			inpos += length+3;
			outpos += length;

			// Repeat data already in the outpot.
			length = (code & 0x3f) + 4;
			let offset = (a & 0x3f)*256 + b + 1;
			memcpy(out, outpos, out, outpos-offset, length);
			outpos += length;

		} else if (!(code & 0x20)) {
			let c = input[inpos+3];
			let length = code & 3;
			memcpy(out, outpos, input, inpos+4, length);
			inpos += length+4;
			outpos += length;

			// Repeat data that is already in the output.
			length = ((code>>2) & 3)*256 + c + 5;
			let offset = ((code & 0x10)<<12)+256*a + b + 1;
			memcpy(out, outpos, out, outpos-offset, length);
			outpos += length;

		} else {

			// The last case means there's no compression really, we just copy 
			// as is.
			let length = (code & 0x1f)*4 + 4;
			memcpy(out, outpos, input, inpos+1, length);
			inpos += length+1;
			outpos += length;

		}

	}

	// Trailing bytes. This is indicated by the control character being 
	// greater than 0xfc.
	if (inpos < input.length && outpos < out.length) {
		let length = input[inpos] & 3;
		memcpy(out, outpos, input, inpos+1, length);
		outpos += length;
	}

	// Check if everything is correct.
	if (outpos !== out.length) {
		throw new Error('Error when decompressing!');
	}

	// We're done!
	return out;

}
exports.decompress = decompress;

// # memcpy(out, outpos, input, inpos, length)
// LZ-compatible memcopy function. We don't use buffer.copy here because we 
// might be copying from ourselves as well!
function memcpy(out, outpos, input, inpos, length) {
	let i = length;
	while (i--) {
		out[outpos++] = input[inpos++];
	}
}

// # array(size, fill)
// Helper function for building up a specified array.
function array(size, fill) {
	let out = [];
	for (let i = 0; i < size; i++) {
		out.push(fill());
	}
	return out;
}

// Performance calibration constants for compression.
const QFS_MAXITER = 50;
const WINDOW_LEN = 2**17;
const WINDOW_MASK = WINDOW_LEN-1;

// # compress(input)
// A JavaScript implementation of QFS compression. We use a smart buffer here 
// so that we don't have to manage the output size manually.
function compress(input) { 

	// Initialize our occurence tables. The C++ code is rather difficult to 
	// understand here, but we need to understand that we're basically storing 
	// pointers here. While in C++ those are actually memory addresses, for us 
	// they are just numbers, where 0 is the start of the input!
	let out = new SmartBuffer();

	// Initialize our occurence tables. The C++ code is rather difficult to 
	// understand here as there is a lot of pointer magic involved. Anyway, 
	// `rev_similar` is an array where we store integers for every input 
	// position, constrained to the window mask.
	let rev_similar = new Int32Array(WINDOW_LEN).fill(-1);

	// The `rev_last` code is a lot more difficult to understand though. In C++ 
	// it's a data structure that can hold 256 x 256 integer pointers. This is 
	// actually a table for tracking the *offset* at which the last [a, b] byte 
	// sequence was found! As such we'll implement this table a bit differently.
	let rev_last = array(256, () => new Int32Array(256).fill(-1));

	// Given that we're only writing bytes, create a shortcut function for it.
	const push = byte => out.writeUInt8(byte);

	// Don't know exactly what this does lol, but it's duplicated so we create 
	// a function for it.
	let inpos = 0;
	let lastwrot = 0;
	const fill = () => {
		while (inpos - lastwrot >= 4) {
			let length = Math.floor((inpos - lastwrot)/4) - 1;
			if (length > 0x1b) length = 0x1b;
			push(0xe0 + length);
			length = 4*length + 4;
			while (length--) push(input[lastwrot++]);
		}
	};

	// Write the header to the output.
	push(0x10);
	push(0xfb);
	push(input.length >> 16);
	push((input.length >> 8) & 0xff);
	push(input.length & 0xff);

	// Main encoding loop.
	for (; inpos < input.length-1; inpos++) {

		// Update the occurence tables. The C++ code uses some pointer magic 
		// for this, but we will do it in a more modern way. We simply update 
		// the last time this combination was found.
		let a = input[inpos];
		let b = input[inpos+1];
		let offs = rev_similar[inpos & WINDOW_MASK] = rev_last[a][b];
		rev_last[a][b] = inpos;

		// If this part has already been compressed, skip ahead.
		if (inpos < lastwrot) continue;

		// Look for a redundancy now.
		let bestlen = 0;
		let bestoffs = 0;
		let i = 0;
		while (offs >= 0 && inpos-offs < WINDOW_LEN && i++ < QFS_MAXITER) {
			let length = 2;
			let incmp = inpos + 2;
			let inref = offs + 2;
			while (
				incmp < input.length &&
				inref < input.length &&
				input[incmp++] === input[inref++] &&
				length < 1028
			) {
				length++;
			}
			if (length > bestlen) {
				bestlen = length;
				bestoffs = inpos-offs;
			}
			offs = rev_similar[offs & WINDOW_MASK];
		}

		// Check if redundancy is good enough.
		if (bestlen > input.length-inpos) {
			bestlen = inpos-input.length;
		} else if (
			bestlen <= 2 ||
			(bestlen === 3 && bestoffs > 1024) ||
			(bestlen === 4 && bestoffs > 16384)
		) {
			continue;
		}

		// If we did not find a suitable redundancy length by now, continue. 
		// We do this to avoid additional nesting.
		if (!bestlen) continue;

		// Cool, we found a good redundancy. Now write away.
		fill();
		let length = inpos-lastwrot;
		if (bestlen <= 10 && bestoffs <= 1024) {

			// 2-byte control character.
			let d = bestoffs-1;
			push(((d>>8)<<5) + ((bestlen-3)<<2) + length);
			push(d & 0xff);
			while (length--) push(input[lastwrot++]);
			lastwrot += bestlen;

		} else if (bestlen <= 67 && bestoffs <= 16384) {

			// 3-byte control character.
			let d = bestoffs-1;
			push(0x80 + (bestlen-4));
			push((length<<6) + (d>>8));
			push(d & 0xff);
			while (length--) push(input[lastwrot++]);
			lastwrot += bestlen;

		} else if (bestlen <= 1028 && bestoffs < WINDOW_LEN) {
			
			// 4-byte control character.
			let d = bestoffs-1;
			push(0xC0 + ((d>>16)<<4) + (((bestlen-5)>>8)<<2) + length);
	        push((d>>8) & 0xff);
	        push(d & 0xff);
	        push((bestlen-5) & 0xff);
	        while (length--) push(input[lastwrot++]);
	        lastwrot += bestlen;

		}

	}

	// Grab the length of what still needs to be processed and write it away 
	// as a control character. Then, write the raw contents.
	inpos = input.length;
	fill();
	let length = inpos - lastwrot;
	push(0xfc + length);
	while (length--) push(input[lastwrot++]);

	// We're done!
	return out.toBuffer();

}
exports.compress = compress;
