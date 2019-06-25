// # stream.js
"use strict";

// Monkey-patch big ints.
if (!Buffer.prototype.readBigInt64LE) {
	Buffer.prototype.readBigInt64LE = function(offset = 0) {
		return new DataView(this.buffer).getBigInt64(offset, true);
	};
	Buffer.prototype.writeBigInt64LE = function(nr, offset = 0) {
		let dv = new DataView(this.buffer);
		dv.setBigInt64(offset, nr, true);
		return offset + 8;
	}
}

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

	// ## string()
	// Reads a string with the given length, as utf8.
	string(length) {
		let start = this.skip(length);
		return this.buffer.toString('utf8', start, this.i);
	}

	// ## read(n=1)
	read(n=1) {
		let offset = this.buffer.offset;
		return Buffer.from(this.raw, offset+this.skip(n), n);
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
	bool() { return Boolean(this.uint8()); }

}

module.exports = Stream;