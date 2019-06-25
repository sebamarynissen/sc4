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

	it.only('we\'re trying to decode it', function() {

		// let file = path.resolve(__dirname, 'files/City - Double - check.sc4');
		let file = path.resolve(REGION, 'City - Textures.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));
		let textureFile = dbpf.getByType(FileType.BaseTextureFile);

		let buff = textureFile.read();

		// Cut the buffer in pieces.
		let pieces = [];
		while (buff.length > 4) {
			let size = buff.readUInt32LE(0);
			pieces.push(buff.slice(0, size));
			buff = buff.slice(size);
		}

		console.log(pieces.length);
		console.log(pieces.map(x => x.length));
		for (let piece of pieces) {
			let rs = new Stream(piece);
			let size = rs.dword();
			let crc = rs.dword();
			let mem = rs.dword();
			let major = rs.word();
			let minor = rs.word();

			let id = '25 8E 30 00'.split(' ').reverse().join('');

			// console.log({size, crc, mem, major, minor});
			let format = '4 4 4 2 2 4 4 1 1 1 1 2 2 4 4 4 4 4 2 2 4 4 4 4 4 4 4 4'.split(' ').map(x => 2*(+x));
			let hex = piece.toString('hex');

			console.log(chunk(format, hex));

		}

	});

});