// # stream.js
'use strict';
const Pointer = require('./pointer.js');

// # Stream
// Helper class that provides some methods for reading from a buffer 
// sequentially, maintaining buffer state.
class Stream {

	// ## constructor(buffer)
	constructor(buffer) {
		this.buffer = buffer;
		this.raw = buffer.buffer;
		this.i = 0;
	}

	// ## eof()
	eof() {
		return !(this.i < this.buffer.byteLength);
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

	// ## string(length)
	// Reads a string with the given length, as utf8. Note: if no length is 
	// given, we assume we have to read the length first as a dword.
	string(length = this.dword()) {
		let start = this.skip(length);
		return this.buffer.toString('utf8', start, this.i);
	}

	// ## read(n=1)
	read(n=1) {
		let offset = this.buffer.offset;
		return Buffer.from(this.raw, offset+this.skip(n), n);
	}

	// ## slice(n=1)
	// Similar to read, but returns a new buffer instead of just a view on top 
	// of the underlying buffer.
	slice(n=1) {
		return this.buffer.slice(this.skip(n), this.i);
	}

	// ## chunk()
	// Reads a chunk where the first 4 bytes are the size of the chunk. This 
	// is useful when parsing files because a lot of them have the structure 
	// "SIZE CRC MEM ...". Note that we return a view on top of the underlying 
	// buffer, we don't copy it!
	chunk() {
		let size = this.buffer.readUInt32LE(this.i);
		return this.read(size);
	}

	// ## rest()
	// Helper function for reading the rest of the buffer - as a slice.
	rest() {
		return this.read(this.buffer.length - this.i);
	}

	peek() { return this.buffer[this.i]; }
	int8() { return this.buffer.readInt8(this.skip(1)); }
	int16() { return this.buffer.readInt16LE(this.skip(2)); }
	int32() { return this.buffer.readInt32LE(this.skip(4)); }
	bigint64() { return this.buffer.readBigInt64LE(this.skip(8)); }
	float() { return this.buffer.readFloatLE(this.skip(4)); }
	double() { return this.buffer.readDoubleLE(this.skip(8)); }
	uint8() { return this.buffer.readUInt8(this.skip(1)); }
	uint16() { return this.buffer.readUInt16LE(this.skip(2)); }
	uint32() { return this.buffer.readUInt32LE(this.skip(4)); }

	// Some aliases.
	byte() { return this.uint8(); }
	word() { return this.uint16(); }
	dword() { return this.uint32(); }
	qword() { return this.bigint64(); }
	bool() { return Boolean(this.uint8()); }

	// Helper function for reading a pointer. Those are given as [pointer, 
	// Type ID]. Note that if no address was given, we return "null" (i.e. a 
	// null pointer).
	pointer() {
		let address = this.dword();
		if (address === 0x00000000) return null;
		let type = this.dword();
		return new Pointer(type, address);
	}

	// Helper function for reading in an array. We first read in the length 
	// and then fill up the array. It's important that the function passed 
	// properly consumers the readable stream though!
	array(fn) {
		let arr = new Array(this.dword());
		for (let i = 0; i < arr.length; i++) {
			arr[i] = fn.call(this, this, i);
		}
		return arr;
	}

	// ## struct(Constructor)
	// Helper method for reading in a specific data structure. The premisse is 
	// that the class implements a `parse(rs)` method.
	struct(Constructor) {
		let struct = new Constructor();
		struct.parse(this);
		return struct;
	}

	// ## assert()
	// Helper method that ensures the stream has been fully consumed. Throws 
	// an error if it's not the case. Useful for checking if a decoded 
	// structure is valid for all kinds of cities.
	assert() {
		let { i, buffer } = this;
		if (i !== buffer.length) {
			let n = buffer.length - i;
			throw new Error(`Stream has not been fully consumed yet! ${n} bytes remaining!`);
		}
	}

}

module.exports = Stream;