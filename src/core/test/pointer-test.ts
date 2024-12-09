// # pointer-test.js
import { expect } from 'chai';
import { kFileType, Pointer } from 'sc4/core';

describe('A pointer', function() {

	context('#constructor()', function() {

		it('is constructed from a type and address', function() {
			let ptr = new Pointer(0x0123abcd, 0x12345678);
			expect(ptr.type).to.equal(0x0123abcd);
			expect(ptr.address).to.equal(0x12345678);
			expect(+ptr).to.equal(0x12345678);
		});

		it('is constructed from a record', function() {

			class Record {
				static [kFileType] = 0xaabbccdd;
				mem: number;
				constructor(mem: number) {
					this.mem = mem;
				}
				parse() {}
			}
			let record = new Record(0x11223344);
			let ptr = new Pointer(record);
			expect(ptr.type).to.equal(0xaabbccdd);
			expect(ptr.address).to.equal(0x11223344);
			expect(+ptr).to.equal(0x11223344);

		});

	});

});
