// # qfs.js
'use strict';
const { decompress, compress } = require('./lib-cpp');

// # decompress(buff)
// Export the JavaScript wrapper for decompressing QFS encoded data.
exports.decompress = function(buff) {

	// First 4 bytes are the compressed size. We don't need to pass this, so 
	// skip them. Note that we used to pass the *uncompressed* buffer size to 
	// C++ as well, but that's not required, it can decode it itself just fine!
	buff = buff.slice(4);
	return decompress(buff);

};

// # compress(buff)
// Exports the JavaScript wrapper for compressing QFS encoded data.
exports.compress = function(buff) {
	buff = compress(buff, buff.byteLength);
	let target = Buffer.allocUnsafe(buff.byteLength+4);
	target.writeUInt32LE(target.byteLength);
	buff.copy(target, 4);
	return target;
};

// # jsDecompress(buffer)
// JavaScript implementation of the QFS decompression algorithm.
function jsDecompress(buffer) {

	// First four bytes are the size of the buffer, this is redundant.
	let input = buffer.slice(4);

	// First two bytes are 0x10fb (QFS id), then follows the *uncompressed* 
	// size, which allows us to prepare a buffer for it.
	const size = 0x10000*input[2] + 0x100*input[3] + input[4];
	const out = Buffer.alloc(size, 0xff);

	// Start decoding now.
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

	// Trailing bytes.
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

// # memcpy(out, outpos, input, inpos, length)
// LZ-compatible memcopy function. We don't use buffer.copy here because we 
// might be copying from ourselves as well!
function memcpy(out, outpos, input, inpos, length) {
	let i = length;
	while (i--) {
		out[outpos++] = input[inpos++];
	}
}
