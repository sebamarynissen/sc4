// # texture-file-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');
const { hex, chunk } = require('../lib/util');
const { FileType } = require('../lib/enums');
const Savegame = require('../lib/savegame');
const Stream = require('../lib/stream');
const REGION = require('./test-region');

describe('A base texture file', function() {

	it('should be parsed & serialized correctly', function() {

		// let file = path.resolve(__dirname, 'files/City - RCI.sc4');
		let file = path.resolve(__dirname, 'files/city.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));
		let entry = dbpf.getByType(FileType.BaseTextureFile);
		let textureFile = entry.read();

		// Loop all textures and see if we find different values for the 
		// unknowns. "u10" is know to have seen values 0x02 or 0x01. u4 in the
		// texture has only seen value 0x05 while u5 has only seen value 
		// 0x497f6d9d. For all the rest only "0" has been observed.
		let sets = {};
		let tsets = {};
		for (let base of textureFile) {

			// Loop the textures.
			for (let texture of base.textures) {
				for (let key in texture) {
					if (!key.match(/^u[\d]+/)) continue;
					let set = tsets[key] || (tsets[key] = new Set());
					set.add(hex(texture[key], 2));
				}
			}

			for (let key in base) {
				if (!key.match(/^u[\d]+/)) continue;
				let set = sets[key] || (sets[key] = new Set());
				set.add(base[key]);
			}
		}

		// console.log(sets);
		// console.log(tsets);

		// Now serialize again.
		let source = entry.decompress();
		let check = textureFile.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});