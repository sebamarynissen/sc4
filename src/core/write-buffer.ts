// # write-buffer.ts
import { SmartBuffer } from 'smart-arraybuffer';
import xcrc from './crc.js';
import type Color from './color.js';
import type Vertex from './vertex.js';
import type Pointer from './pointer.js';
import type {
	byte,
	double,
	dword,
	float,
	sint8,
	sint16,
	sint32,
	sint64,
	uint8,
	uint16,
	uint32,
	word,
    qword,
    TGILike,
} from 'sc4/types';
import type { Box3, ParseOptions } from './box-3.js';
import type TractInfo from './tract-info.js';
import type { Vector3Like } from './vector-3.js';
import TGI from './tgi.js';

type HasWrite = { write: (arr: WriteBuffer) => any };
type HasToBuffer = { toBuffer: () => Uint8Array };
type Writable = Uint8Array | HasWrite | HasToBuffer;

// # WriteBuffer()
// The WriteBuffer class replaces the WriteStream class by making not 
// requiring us to build up a buffer of unknown size manually. It uses the 
// smart-buffer module under the hood, but renames a few methods so that it's 
// easier to work with. Under the hood we'll also provide support for 
// "formatting" the buffer, i.e. adding the size and the checksum in front of 
// it automatically, which is what we often need.
const encoder = new TextEncoder();
export default class WriteBuffer extends SmartBuffer {

	// ## write(buffer, )
	// The write method is used for writing a raw buffer.
	write(buffer: Writable, offset?: number) {

		// If an object was passed instead of a raw buffer, we'll check if 
		// either:
		//  - the object supports writing to the buffer.
		//  - the object has a `toBuffer()` method.
		if (!(buffer instanceof Uint8Array)) {
			if ('write' in buffer) {
				buffer.write(this);
				return;
			} else {
				buffer = buffer.toBuffer();
			}
		}
		super.writeBuffer(buffer, offset);
	}

	// ## string(str)
	// Writing a string will first write the string length as a uint32 and 
	// then the string itself.
	string(str: string, opts: { length?: number } = {}) {
		let { length = true } = opts;
		let buffer = encoder.encode(str);
		if (length) {
			this.writeUInt32LE(buffer.byteLength);
		}
		this.write(buffer);
	}

	// Simple aliases.
	int8(value: sint8) { this.writeInt8(value); }
	int16(value: sint16) { this.writeInt16LE(value); }
	int32(value: sint32) { this.writeInt32LE(value); }
	bigint64(value: sint64) { this.writeBigInt64LE(BigInt(value)); }
	float(value: float) { this.writeFloatLE(value); }
	double(value: double) { this.writeDoubleLE(value); }
	uint8(value: uint8) { this.writeUInt8(value); }
	byte(value: byte) { this.writeUInt8(value); }
	bool(value: boolean) { this.writeUInt8(Number(value)); }
	uint16(value: uint16) { this.writeUInt16LE(value); }
	word(value: word) { this.writeUInt16LE(value); }
	uint32(value: uint32) { this.writeUInt32LE(value); }
	dword(value: dword) { this.writeUInt32LE(value); }
	qword(value: qword) { this.writeBigUInt64LE(value); }

	// ## n()
	// Fills the buffer with the given amount of zeroes.
	zeroes(n: number) {
		for (let i = 0; i < n; i++) this.uint8(0);
	}

	// ## array(arr)
	// Helper function for writing away an array of objects. We first insert 
	// the array's length and then try to convert to buffers.
	array<T extends Writable>(arr: T[]): void;
	array<T>(arr: T[], fn: (item: T) => any): void;
	array<T>(arr: T[], fn: (item: any) => any = (item => this.write(item))): void {
		this.uint32(arr.length);
		for (let item of arr) {
			fn(item);
		}
	}

	// ## tuple(arr)
	// Helper function for writing away a tuple, which is an array of *fixed* 
	// length. The difference with "array" is that we don't prefix it with the 
	// length.
	tuple<T>(arr: T[], fn?: (item: T) => any): void;
	tuple<T>(arr: T[], fn: (item: any) => any = (item => this.write(item))): void {
		for (let item of arr) {
			fn.call(this, item);
		}
	}

	// ## tgi()
	// Writes away a TGI.
	tgi(tgi: TGILike) {
		let [type, group, instance] = new TGI(tgi);
		this.dword(type);
		this.dword(group);
		this.dword(instance);
	}

	// ## gti()
	// Writes away a TGI to the buffer, but in gti form. That's because for some 
	// reason, TGI's are often stored as GTI in savegames.
	gti(tgi: TGILike) {
		let [type, group, instance] = new TGI(tgi);
		this.dword(group);
		this.dword(type);
		this.dword(instance);
	}

	// ## version(version)
	// Writes away a version string.
	version(version: string) {
		let parts = version.split('.');
		for (let part of parts) {
			this.word(+part);
		}
	}

	// ## pointer(ptr)
	// Writes a pointer data structure to the buffer. If the pointer is 
	// nullish, we write away 0x00000000, i.e. a null pointer.
	pointer(ptr: Pointer | null) {
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

	// ## vector3()
	// Writes away a 3D vector.
	vector3(vector: Vector3Like) {
		this.float(vector[0]);
		this.float(vector[1]);
		this.float(vector[2]);
	}

	// ## color(color)
	// Writes a color data structure to the buffer.
	color(color: Color) {
		this.byte(color.r);
		this.byte(color.g);
		this.byte(color.b);
		this.byte(color.a);
	}

	// ## vertex(vertex)
	// Writes a vertex data structure to the buffer.
	vertex(vertex: Vertex) {
		vertex.write(this);
	}

	// ## tract(tractInfo)
	// Writes a tract info data structure to the buffer.
	tract(tract: TractInfo) {
		tract.write(this);
	}

	// ## bbox(bbox)
	// Writes a bbox data structure to the buffer.
	bbox(bbox: Box3, opts?: ParseOptions) {
		bbox.write(this, opts);
	}

	// ## seal()
	// This method returns a new buffer where the checksum and size have been 
	// prepended. We use this all the time.
	seal(): Uint8Array {

		// First of all we'll calculate the CRC checksum for the buffer.
		let buffer = this.toUint8Array();
		let sum = xcrc(buffer);

		// Next we'll prefix it with the size and calculated checksum.
		this.insertUInt32LE(buffer.length + 8, 0);
		this.insertUInt32LE(sum, 4);
		return this.toUint8Array();

	}

	// ## toBuffer()
	toBuffer() {
		console.warn('`.toBuffer()` only works in Node.js environments and should be avoided. Use `.toUint8Array()` instead!');
		return super.toBuffer();
	}

}
