// # texture-file-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import { hex } from 'sc4/utils';
import { Savegame, FileType } from 'sc4/core';
import { resource } from '#test/files.js';

describe('A base texture file', function() {

	it('should be parsed & serialized correctly', function() {

		let file = resource('city.sc4');
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
		entry.read();
		let check = entry.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});
