// # pointer-test.js
'use strict';
const { expect } = require('chai');
const Pointer = require('../lib/pointer.js');
const Type = require('../lib/type.js');

describe('A pointer', function() {

	context('#constructor()', function() {

		it('is constructed from a type and address', function() {
			let ptr = new Pointer(0x0123abcd, 0x12345678);
			expect(ptr.type).to.equal(0x0123abcd);
			expect(ptr.address).to.equal(0x12345678);
			expect(+ptr).to.equal(0x12345678);
		});

		it('is constructed from a record', function() {

			class Record extends Type(0xaabbccdd) {
				constructor(mem) {
					super();
					this.mem = mem;
				}
			}
			let record = new Record(0x11223344);
			let ptr = new Pointer(record);
			expect(ptr.type).to.equal(0xaabbccdd);
			expect(ptr.address).to.equal(0x11223344);
			expect(+ptr).to.equal(0x11223344);

		});

	});

});
