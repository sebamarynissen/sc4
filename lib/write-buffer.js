// # smart-buffer.js
'use strict';
const { SmartBuffer } = require('smart-buffer');
const crc32 = require('./crc.js');

// # WriteBuffer()
// The WriteBuffer class replaces the WriteStream class by making not 
// requiring us to build up a buffer of unknown size manually. It uses the 
// smart-buffer module under the hood, but renames a few methods so that it's 
// easier to work with. Under the hood we'll also provide support for 
// "formatting" the buffer, i.e. adding the size and the checksum in front of 
// it automatically, which is what we often need.
class WriteBuffer extends SmartBuffer {

	// ## constructor(...args)
	constructor(...args) {
		super(...args);
		this.crc = 0x00000000;
	}

	// ## write(...args)
	// The write method is used for writing a raw buffer.
	write(...args) {
		super.writeBuffer(...args);
	}

	// ## string(str)
	// Writing a string will first write the string length as a uint32 and 
	// then the string itself.
	string(str) {
		let buffer = Buffer.from(str, 'utf8');
		this.writeUInt32LE(buffer.byteLength);
		this.write(buffer);
	}

	// Simple aliases.
	int8(x) { this.writeInt8(x); }

	int16(x) { this.writeInt16LE(x); }

	int32(x) { this.writeInt32LE(x); }

	bigint64(x) { this.writeBigInt64LE(BigInt(x)); }

	float(x) { this.writeFloatLE(x); }

	double(x) { this.writeDoubleLE(x); }

	uint8(x) { this.writeUInt8(x); }
	byte(x) { this.writeUInt8(x); }
	bool(x) { this.writeUInt8(Number(x)); }

	uint16(x) { this.writeUInt16LE(x); }
	word(x) { this.writeUInt16LE(x); }

	uint32(x) { this.writeUInt32LE(x); }
	dword(x) { this.writeUInt32LE(x); }

	// ## array(arr)
	// Helper function for writing away an array of objects. We first insert 
	// the array's length and then try to convert to buffers.
	array(arr) {
		this.uint32(arr.length);
		for (let buffer of arr) {
			if (!Buffer.isBuffer(buffer) && buffer.toBuffer) {
				buffer = buffer.toBuffer();
			}
			this.write(buffer);
		}
	}

	// ## pointer(ptr)
	// Writes a pointer data structure to the buffer.
	pointer(ptr) {
		this.dword(ptr.address);
		this.dword(ptr.type);
	}

	// ## seal()
	// This method returns a new buffer where the checksum and size have been 
	// prepended. We use this all the time.
	seal() {

		// First of all we'll calculate the crc checksum for the buffer.
		let buffer = this.toBuffer();
		let sum = this.crc = crc32(buffer);

		// Next we'll prefix it with the size and calculated checksum.
		let prefix = Buffer.allocUnsafe(8);
		prefix.writeUInt32LE(buffer.length + prefix.length, 0);
		prefix.writeUInt32LE(sum, 4);
		return Buffer.concat([prefix, buffer]);

	}

	// ## [Symbol.toPrimitive]()
	// Helper function that return the checksum once it has been calculated. 
	// This can be useful to update the checksum of entries, but we're not 
	// sure whether this is actually useful.
	[Symbol.toPrimitive]() {
		return this.crc;
	}

}
module.exports = WriteBuffer;
