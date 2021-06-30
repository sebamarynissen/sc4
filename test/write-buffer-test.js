// # write-stream-test.js
'use strict';
const { expect } = require('chai');
const WriteBuffer = require('sc4/lib/write-buffer.js');

describe('A WriteBuffer', function() {

	it('prefixes a string with its length', function() {

		let buffer = new WriteBuffer();
		let str = 'Hello world!';
		buffer.string(str);
		let out = buffer.toBuffer();
		expect(out.length).to.equal(4+str.length);
		expect(out.slice(4).toString('utf8')).to.equal(str);

	});

	it('writes integers as LE', function() {

		let buffer = new WriteBuffer();
		buffer.int16(16);
		buffer.int32(32);
		let out = buffer.toBuffer();
		expect(out.length).to.equal(2+4);
		expect(out.readInt16LE(0)).to.equal(16);
		expect(out.readInt32LE(2)).to.equal(32);

	});

	it('writes big integers', function() {

		let buffer = new WriteBuffer();
		buffer.bigint64(100n);
		let out = buffer.toBuffer();
		expect(out).to.have.length(8);
		let int = out.readBigInt64LE(0);
		expect(int).to.equal(100n);

	});

	it('converts numbers to bigints', function() {

		let buffer = new WriteBuffer();
		buffer.bigint64(10);
		let out = buffer.toBuffer();
		expect(out.readBigInt64LE(0)).to.equal(10n);

	});

	it('uses aliases', function() {

		let buffer = new WriteBuffer();
		buffer.dword(4);
		buffer.word(2);
		buffer.bool(1);
		expect(buffer).to.have.length(7);

	});

	it('adds the size and checksum', function() {

		let buffer = new WriteBuffer();
		buffer.uint32(4242);
		let out = buffer.seal();
		expect(out).to.have.length(12);
		expect(out.readUInt32LE(0)).to.equal(out.length);
		let sum = out.readUInt32LE(4);
		expect(sum).to.not.equal(0);
		expect(sum).to.equal(+buffer);

	});

	it('automatically writes arrays', function() {

		let obj = { toBuffer: () => Buffer.from('bar') };
		let buffer = new WriteBuffer();
		let arr = [
			Buffer.from('foo'),
			obj,
		];
		buffer.array(arr);
		let out = buffer.toBuffer();
		expect(out).to.have.length(4+3+3);
		expect(out.readUInt32LE(0)).to.equal(arr.length);
		expect(out.toString('utf8', 4)).to.equal('foobar');

	});

});
