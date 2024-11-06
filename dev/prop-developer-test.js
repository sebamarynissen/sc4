// # prop-developer-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import { Savegame, FileType } from 'sc4/core';
import { hex, chunk, split } from 'sc4/utils';

describe('The PropDeveloper Subfile', function() {

	it.skip('should read small city tiles', function() {
		let file = path.resolve(__dirname, 'files/city - RCI.sc4');
		if (!fs.existsSync(file)) {
			return this.skip();
		}
		let dbpf = new Savegame(fs.readFileSync(file));

		let txFile = dbpf.baseTextureFile;
		let all = [];
		txFile.map(function(tx) {
			tx.textures.map(function(tile) {
				let mem = tile.IID;
				all.push(hex(mem));
			});
		});
		console.log(all+'');

		let props = dbpf.propFile;
		console.log('There are', props.length, 'props');
		let entry = dbpf.getByType(FileType.PropDeveloperFile);

		let buff = entry.read();
		console.log('size', buff.readUInt32LE(0));
		let str = buff.toString('hex');
		// let slice = str.slice(260 - 16, 260-8 + 8*26);

		let match = str.match(/47aa7729/g);
		console.log(match);

		// console.log(entry.read().toString('hex').indexOf('47aa7729'));

		// let slice = entry.read().toString('hex').slice(0, 128);
		// let format = '4 4 4 1 4 4 4 4 4'.split(' ').map(x => 2*x);
		// let format = new Array(100).fill(8);
		// console.log(chunk(format, slice));

		// let check = entry.decompress();
		// let dev = entry.read();
		// expect(dev.tileSize).to.equal(64+1);
		// expect(dev.buildings).to.have.length(buildings.length);

		// let crc = dev.crc;
		// let buff = dev.toBuffer();
		// expect(buff.readUInt32LE(4)).to.equal(crc);

	});

});
