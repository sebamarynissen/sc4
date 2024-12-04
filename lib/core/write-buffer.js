// # smart-buffer.js
import { SmartBuffer } from 'smart-arraybuffer';
import xcrc from './crc.js';

// # WriteBuffer()
// The WriteBuffer class replaces the WriteStream class by making not 
// requiring us to build up a buffer of unknown size manually. It uses the 
// smart-buffer module under the hood, but renames a few methods so that it's 
// easier to work with. Under the hood we'll also provide support for 
// "formatting" the buffer, i.e. adding the size and the checksum in front of 
// it automatically, which is what we often need.
const encoder = new TextEncoder();
export default class WriteBuffer extends SmartBuffer {

	// ## write(buffer, ...rest)
	// The write method is used for writing a raw buffer.
	write(buffer, ...rest) {

		// If an object was passed instead of a raw buffer, we'll check if 
		// either:
		//  - the object supports writing to the buffer.
		//  - the object has a `toBuffer()` method.
		if (!(buffer instanceof Uint8Array)) {
			if (buffer.write) {
				buffer.write(this);
				return;
			} else {
				buffer = buffer.toBuffer();
			}
		}
		super.writeBuffer(buffer, ...rest);
	}

	// ## string(str)
	// Writing a string will first write the string length as a uint32 and 
	// then the string itself.
	string(str, opts = {}) {
		let { length = true } = opts;
		let buffer = encoder.encode(str);
		if (length) {
			this.writeUInt32LE(buffer.byteLength);
		}
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

	// ## n()
	// Fills the buffer with the given amount of zeroes.
	zeroes(n) {
		for (let i = 0; i < n; i++) this.uint8(0);
	}

	// ## array(arr)
	// Helper function for writing away an array of objects. We first insert 
	// the array's length and then try to convert to buffers.
	array(arr, fn = buffer => this.write(buffer)) {
		this.uint32(arr.length);
		for (let item of arr) {
			fn(item);
		}
	}

	// ## pointer(ptr)
	// Writes a pointer data structure to the buffer. If the pointer is 
	// nullish, we write away 0x00000000, i.e. a null pointer.
	pointer(ptr) {
		if (!ptr) {
			this.dword(0x00000000);
			return;
		}
		let { address = ptr.mem } = ptr;
		this.dword(address);
		if (address > 0) {
			this.dword(ptr.type);
		}
	}

	// ## color(color)
	// Writes a color data structure to the buffer.
	color(color) {
		this.byte(color.r);
		this.byte(color.g);
		this.byte(color.b);
		this.byte(color.a);
		return this;
	}

	// ## vertex(vertex)
	// Writes a vertex data structure to the buffer.
	vertex(vertex) {
		vertex.write(this);
		return this;
	}

	// ## seal()
	// This method returns a new buffer where the checksum and size have been 
	// prepended. We use this all the time.
	seal() {

		// First of all we'll calculate the CRC checksum for the buffer.
		let buffer = this.toUint8Array();
		let sum = xcrc(buffer);

		// Next we'll prefix it with the size and calculated checksum.
		this.insertUInt32LE(buffer.length + 8, 0);
		this.insertUInt32LE(sum, 4);
		return this.toBuffer();

	}

}
