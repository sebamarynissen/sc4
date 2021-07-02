// # qfs-test.js
'use strict';
const { expect } = require('chai');
const js = require('sc4/qfs/js');
const cpp = require('sc4/qfs/cpp');

describe('The compression algorithm', function() {

	before(function() {
		this.compare = function(a, b) {
			expect(Buffer.compare(a, b)).to.equal(0);
		}
	});

	it('can be compressed and decompressed', function() {
		this.timeout(0);
		for (let i = 0; i < 64; i++) {
			let x = Buffer.allocUnsafe(i*1024);
			let y = js.compress(x);
			let xx = js.decompress(y);
			this.compare(x, xx);

			if (i > 2) {
				let cy = cpp.compress(x);
				let cxx = js.decompress(cy);
				this.compare(cxx, x);
			}

		}

	});

	it('a buffer with a redundancy at the end', function() {

		let x = Buffer.from('abcdefggabcd')
		let y = js.compress(x);
		let xx = js.decompress(y);
		this.compare(x, xx);

	});

});
