// # write-stream-test.js
import { expect } from 'chai';
import { SmartBuffer } from 'smart-arraybuffer';
import WriteBuffer from '../write-buffer.js';
import { uint8ArrayToString } from 'uint8array-extras';

describe('A WriteBuffer', function() {

	it('prefixes a string with its length', function() {

		let buffer = new WriteBuffer();
		let str = 'Hello world!';
		buffer.string(str);
		let out = buffer.toUint8Array();
		expect(out.length).to.equal(4+str.length);
		expect(uint8ArrayToString(out.subarray(4))).to.equal(str);

	});

	it('writes integers as LE', function() {

		let buffer = new WriteBuffer();
		buffer.int16(16);
		buffer.int32(32);
		let out = SmartBuffer.fromBuffer(buffer.toUint8Array());
		expect(out.length).to.equal(2+4);
		expect(out.readInt16LE(0)).to.equal(16);
		expect(out.readInt32LE(2)).to.equal(32);

	});

	it('writes big integers', function() {

		let buffer = new WriteBuffer();
		buffer.bigint64(100n);
		let out = SmartBuffer.fromBuffer(buffer.toArrayBuffer());
		expect(out).to.have.length(8);
		let int = out.readBigInt64LE(0);
		expect(int).to.equal(100n);

	});

	it('converts numbers to bigints', function() {

		let buffer = new WriteBuffer();
		buffer.bigint64(10);
		let out = new DataView(buffer.toArrayBuffer());
		expect(out.getBigInt64(0, true)).to.equal(10n);

	});

	it('uses aliases', function() {

		let buffer = new WriteBuffer();
		buffer.dword(4);
		buffer.word(2);
		buffer.bool(1);
		expect(buffer).to.have.length(7);

	});

	it('automatically writes arrays', function() {

		let obj = { toBuffer: () => new Uint8Array([0x62, 0x61, 0x72]) };
		let buffer = new WriteBuffer();
		let arr = [
			new Uint8Array([0x66, 0x6f, 0x6f]),
			obj,
		];
		buffer.array(arr);
		let out = SmartBuffer.fromBuffer(buffer.toArrayBuffer());
		expect(out).to.have.length(4+3+3);
		expect(out.readUInt32LE(0)).to.equal(arr.length);
		expect(out.toString('utf8').slice(4)).to.equal('foobar');

	});

});
