// # write-stream.js
"use strict";

// # WriteStream()
// Helper class that provides some methods for writing to a buffer in a more 
// user-friendly way than node's default buffer methods. It also keeps track 
// of the position internally.
class WriteStream {

	// ## constructor(buffer)
	constructor(buffer) {
		this.buffer = buffer;
		this.i = 0;
	}

	// ## eof()
	eof() {
		return !(this.i < this.buffer.byteLength);
	}

	// ## jump(offset)
	// Jumps to the given offset in the buffer.
	jump(offset) {
		this.i = offset;
		return this;
	}

	string(x) {
		this.i = this.buffer.write(x, this.i);
	}
	int8(x) {
		this.i = this.buffer.writeInt8(x, this.i);
		return this;
	}
	int16(x) {
		this.i = this.buffer.writeInt16LE(x, this.i);
		return this;	
	}
	int32(x) {
		this.i = this.buffer.writeInt32LE(x, this.i);
		return this;	
	}
	bigint64(x) {
		this.i = this.buffer.writeBigInt64LE(x, this.i);
		return this;
	}
	float(x) {
		this.i = this.buffer.writeFloatLE(x, this.i);
		return this;	
	}
	double(x) {
		this.i = this.buffer.writeDoubleLE(x, this.i);
		return this;
	}
	uint8(x) {
		this.i = this.buffer.writeUInt8(x, this.i);
		return this;
	}
	uint16(x) {
		this.i = this.buffer.writeUInt16LE(x, this.i);
		return this;	
	}
	uint32(x) {
		this.i = this.buffer.writeUInt32LE(x, this.i);
		return this;	
	}

	// Some aliases.
	byte(x) { return this.uint8(x); }
	word(x) { return this.uint16(x); }
	dword(x) { return this.uint32(x); }
	bool(x) { return this.uint8(Number(x)); }

}
module.exports = WriteStream;