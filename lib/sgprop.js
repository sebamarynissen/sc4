// # sgprop.js
"use strict";
const WriteStream = require('./write-stream');
const DataType = Object.freeze({
	UInt8: 0x01,
	UInt16: 0x02,
	UInt32: 0x03,
	Int32: 0x07,
	BigInt64: 0x08,
	Float: 0x09,
	Boolean: 0x0b,
	String: 0x0c
});

// # SGProp()
class SGProp {

	// ## constructor()
	// Pre-initializing the values to correct types to produce better 
	// optimized V8 code.
	constructor() {
		this.name = 0x000000;
		this.unknown0 = 0x000000;
		this.type = 0x00;
		this.value = null;
		this.unknown1 = 0x0000;
	}

	// ## parse(rs)
	parse(rs) {

		// Name is doubled for some reason.
		this.name = (rs.dword(), rs.dword());
		this.unknown0 = rs.dword();
		let type = this.type = rs.byte();
		let keyType = rs.byte();
		this.unknown1 = rs.word();

		// Handle strings.
		if (type === DataType.String) {
			const length = rs.dword();
			this.value = rs.string(length);
		} else {
			const reader = readers[type];
			if (keyType === 0x80) {
				const count = rs.dword();
				let value = this.value = new Array(count);
				for (let i = 0; i < count; i++) {
					value[i] = reader(rs);
				}
			} else {
				this.value = reader(rs);
			}
		}

		// Done.
		return this;

	}

	// ## *bgen(opts)
	*bgen(opts) {

		// Calculate the buffer size.
		let value = this.value;
		let size = 16;
		let isArray = Array.isArray(value);
		let isString = typeof value === 'string';
		if (isArray || isString) {
			size += 4 + value.length * sizes[this.type];
		} else {
			size += sizes[this.type];
		}

		// Create our buffer and fill it up.
		const buff = Buffer.allocUnsafe(size);
		const ws = new WriteStream(buff);
		let i = 0;
		ws.dword(this.name);
		ws.dword(this.name);
		ws.dword(this.unknown0);
		ws.byte(this.type);
		let keyType = isArray || isString ? 0x80 : 0x00;
		ws.byte(keyType);
		ws.word(this.unknown1);
		if (isArray) {
			const count = value.length;
			const writer = writers[this.type];
			ws.dword(count);
			for (let j = 0; j < count; j++) {
				writer(ws, value[j]);
			}
		} else if (isString) {
			ws.string(value);
		} else {
			const writer = writers[this.type];
			writer(ws, value);
		}

		// Check that the prop has been serialized correctly.
		if (ws.i !== buff.byteLength) {
			throw new Error([
				'Error writing SGProp!',
				`Buffer has length ${buff.byteLength} but only ${i} bytes written!`,
				`Buffer is: ${buff.toString('hex')}`
			].join(' '));
		}

		yield buff;

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

}

module.exports = SGProp;

const readers = new Array(0x0c).fill(x => x);
readers[0x01] = rs => rs.uint8();
readers[0x02] = rs => rs.uint16();
readers[0x03] = rs => rs.uint32();
readers[0x07] = rs => rs.int32();
readers[0x08] = rs => rs.bigint64();
readers[0x09] = rs => rs.float();
readers[0x0b] = rs => Boolean(rs.byte());

const writers = new Array(0x0c).fill(x => x);
writers[0x01] = (ws, value) => ws.uint8(value);
writers[0x02] = (ws, value) => ws.uint16(value);
writers[0x03] = (ws, value) => ws.uint32(value);
writers[0x07] = (ws, value) => ws.int32(value);
writers[0x08] = (ws, value) => ws.bigint64(value);
writers[0x09] = (ws, value) => ws.float(value);
writers[0x0b] = (ws, value) => ws.bool(value);

const sizes = new Array(0x0c).fill(0);
sizes[0x01] = sizes[0x0b] = sizes[0x0c] = 1;
sizes[0x02] = 2;
sizes[0x03] = sizes[0x07] = sizes[0x09] = 4;
sizes[0x08] = 8;