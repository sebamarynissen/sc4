// # sgprop.ts
import type { sint32, uint16, uint32, uint8, float } from 'sc4/types';
import type Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
const DataType = Object.freeze({
	UInt8: 0x01,
	UInt16: 0x02,
	UInt32: 0x03,
	Int32: 0x07,
	BigInt64: 0x08,
	Float: 0x09,
	Boolean: 0x0b,
	String: 0x0c,
});

type SGPropPrimitive = uint8 | uint16 | uint32 | sint32 | bigint | float | boolean;
type SGPropValue = null | string | SGPropPrimitive | SGPropPrimitive[];

// # SGProp()
export default class SGProp {
	name = 0x000000;
	unknown0 = 0x000000;
	type = 0x00;
	value: SGPropValue = null;
	unknown1 = 0x0000;

	// ## parse(rs)
	parse(rs: Stream) {

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

	// ## toBuffer()
	toBuffer() {

		const { value } = this;
		const isArray = Array.isArray(value);
		const isString = typeof value === 'string';

		// Start writing to the buffer.
		let ws = new WriteBuffer();
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
			writer(ws, value as SGPropPrimitive);
		}

		// Don't forget to convert the smart buffer into a *normal* buffer!
		return ws.toUint8Array();

	}

}

type Reader = (rs: Stream) => SGPropPrimitive;
type Writer = (ws: WriteBuffer, value: SGPropPrimitive) => any;

const readers: Reader[] = new Array(0x0c);
readers[0x01] = (rs: Stream) => rs.uint8();
readers[0x02] = (rs: Stream) => rs.uint16();
readers[0x03] = (rs: Stream) => rs.uint32();
readers[0x07] = (rs: Stream) => rs.int32();
readers[0x08] = (rs: Stream) => rs.bigint64();
readers[0x09] = (rs: Stream) => rs.float();
readers[0x0b] = (rs: Stream) => rs.bool();

const writers: Writer[] = new Array(0x0c);
writers[0x01] = (ws: WriteBuffer, value: uint8) => ws.uint8(value);
writers[0x02] = (ws: WriteBuffer, value: uint16) => ws.uint16(value);
writers[0x03] = (ws: WriteBuffer, value: uint32) => ws.uint32(value);
writers[0x07] = (ws: WriteBuffer, value: sint32) => ws.int32(value);
writers[0x08] = (ws: WriteBuffer, value: bigint) => ws.bigint64(value);
writers[0x09] = (ws: WriteBuffer, value: float) => ws.float(value);
writers[0x0b] = (ws: WriteBuffer, value: boolean) => ws.bool(value);

const sizes: number[] = new Array(0x0c).fill(0);
sizes[0x01] = sizes[0x0b] = sizes[0x0c] = 1;
sizes[0x02] = 2;
sizes[0x03] = sizes[0x07] = sizes[0x09] = 4;
sizes[0x08] = 8;
