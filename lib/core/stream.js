// # stream.js
import { SmartBuffer } from 'smart-arraybuffer';
import Pointer from './pointer.js';
import SGProp from './sgprop.js';
import Color from './color.js';
import Vertex from './vertex.js';

// # Stream
// Helper class that provides some methods for reading from a buffer 
// sequentially, maintaining buffer state.
export default class Stream extends SmartBuffer {

	// ## constructor(opts)
	constructor(opts) {
		if (opts instanceof Uint8Array || opts instanceof ArrayBuffer) {
			super({ buff: opts });
		} else if (opts instanceof Stream) {
			super({ buff: opts.internalUint8Array });
			this.readOffset = opts.readOffset;
		} else {
			super(opts);
		}
	}

	// ## get i()
	// Some files still rely on the "i" property being present. Hence we still 
	// support this for now, but we should deprecate it.
	get i() {
		return this.readOffset;
	}

	// ## skip(n = 1)
	// Skips n bytes.
	skip(n = 1) {
		this.readOffset += n;
	}

	// ## read()
	read(length) {
		return this.readUint8Array(length);
	}

	// ## string(length)
	// Reads a string with the given length, as utf8. Note: if no length is 
	// given, we assume we have to read the length first as a dword.
	string(length = this.dword()) {
		if (length === Infinity || !length) {
			return this.readString();
		} else {
			return this.readString(length);
		}
	}

	// ## chunk()
	// Reads a chunk where the first 4 bytes are the size of the chunk. This 
	// is useful when parsing files because a lot of them have the structure 
	// "SIZE CRC MEM ...". Note that we return a view on top of the underlying 
	// buffer, we don't copy it!
	chunk() {
		let size = this.readUInt32LE(this.readOffset);
		return this.read(size);
	}

	// ## rest()
	// Helper function for reading the rest of the buffer - as a slice.
	rest() {
		return this.readBuffer();
	}

	int8() { return this.readInt8(); }
	int16() { return this.readInt16LE(); }
	int32() { return this.readInt32LE(); }
	bigint64() { return this.readBigInt64LE(); }
	float() { return this.readFloatLE(); }
	double() { return this.readDoubleLE(); }
	uint8() { return this.readUInt8(); }
	uint16() { return this.readUInt16LE(); }
	uint32() { return this.readUInt32LE(); }

	// Some aliases.
	byte() { return this.uint8(); }
	word() { return this.uint16(); }
	dword() { return this.uint32(); }
	qword() { return this.bigint64(); }
	bool() { return Boolean(this.uint8()); }

	// ## size()
	// The size of a record is simply a dword, but it makes it clearer that 
	// we're reading in a size, so we use an alias.
	size() { return this.dword(); }

	// Helper function for reading a pointer. Those are given as [pointer, 
	// Type ID]. Note that if no address was given, we return "null" (i.e. a 
	// null pointer).
	pointer() {
		let address = this.dword();
		if (address === 0x00000000) return null;
		let type = this.dword();
		return new Pointer(type, address);
	}

	// # color()
	// Reads in a color from the stream.
	color() {
		return new Color(
			this.byte(),
			this.byte(),
			this.byte(),
			this.byte(),
		);
	}

	// ## vertex()
	// Reads in a vertex class from the stream.
	vertex() {
		let vertex = new Vertex();
		vertex.parse(this);
		return vertex;
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

	// ## sgprops()
	// Reads in an array of sgprops.
	sgprops() {
		return this.array(() => new SGProp().parse(this));
	}

	// ## assert()
	// Helper method that ensures the stream has been fully consumed. Throws 
	// an error if it's not the case. Useful for checking if a decoded 
	// structure is valid for all kinds of cities.
	assert() {
		if (this.remaining() > 0) {
			throw new Error(`Stream has not been fully consumed yet! ${n} bytes remaining!`);
		}
	}

}
