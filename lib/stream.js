// # stream.js
"use strict";

// # Stream
// Helper class that provides some methods for reading from a buffer 
// sequentially, maintaining buffer state.
module.exports = class Stream {

	// ## constructor(buffer)
	constructor(buffer) {
		this.buffer = buffer;
		this.raw = buffer.buffer;
		this.i = 0;
	}

	// ## ended()
	ended() {
		return this.i < this.buffer.byteLength;
	}

	// ## skip(n=1)
	// Skips "n" bytes, but returns the position of i as it was before!
	skip(n=1) {
		let i = this.i;
		this.i += n;
		return i;
	}

	// ## jump(offset)
	// Jumps to the given offset.
	jump(offset) {
		this.i = offset;
		return this;
	}

	// ## string()
	// Reads a string with the given length, as utf8.
	string(length) {
		return this.buffer.toString('utf8', this.skip(length), length);
	}

	// ## read(n=1)
	read(n=1) {
		let offset = this.buffer.offset;
		return Buffer.from(this.raw, offset+this.skip(n), n);
	}

	peek() { return this.buffer[this.i]; }
	uint8() { return this.buffer.readUInt8(this.skip(1)); }
	uint16() { return this.buffer.readUInt16LE(this.skip(2)); }
	uint32() { return this.buffer.readUInt32LE(this.skip(4)); }

	// Sepcific method for reverse reading bytes. Used for TGI's.
	revhex(length=4) {
		let i = this.skip(length);
		return this.buffer.slice(i, i+length).reverse().toString('hex');
	}

};