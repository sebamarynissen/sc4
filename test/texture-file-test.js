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

		console.log(sets);
		console.log(tsets);

		// Now serialize again.
		let source = entry.decompress();
		let check = textureFile.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

	});

});

// DWORD	Size	
// DWORD	CRC	
// DWORD	Memory	
// WORD	Major version (0x0002)	
// WORD	Minor version (0x0004)	
// BYTE	Unknown, only seen 0x00	
// BYTE	Unknown, only seen 0x00	
// BYTE	Unknown, only seen 0x00	
// BYTE	Unknown, only seen 0x00	
// DWORD	 0x497f6d9d (always the same)	
// BYTE	Min Tract X (normally between 0x40 and 0x7f)	
// BYTE	Min Tract Z (normally between 0x40 and 0x7f)	
// BYTE	Max Tract X (normally between 0x40 and 0x7f)	
// BYTE	Max Tract X (normally between 0x40 and 0x7f)	
// WORD	X Tract Size? (only seen 0x0002)	
// WORD	Z Tract Size? (only seen 0x0002)	
// DWORD	Unknown, only seen 0x00000000	
// DWORD	Unknown, only seen 0x00000000	
// DWORD	Unknown, only seen 0x00000000	
// FLOAT32	Min X Coordinate	
// FLOAT32	Min Y Coordinate	
// FLOAT32	Min Z Coordinate	
// FLOAT32	Max X Coordinate	
// FLOAT32	Max Y Coordinate	
// FLOAT32	Max Z Coordinate	
// BYTE	Unknown, seen 0x01 and 0x02	
// DWORD	Count of tiles with a texture	
// 	DWORD	Instance ID of the texture
// 	BYTE	X tile
// 	BYTE	Z tile
// 	BYTE 	Orientation
// 	BYTE	Unknown, seen 0x00 and 0x01
// 	4 BYTES	Unknown, mostly 0xff, seen several other values as well
// 	BYTE	Unknown, mostly 0xff but seen 0x03 and 0x01 as well
// 	BYTE	Unknown, seen 0x00 up to 0x07
