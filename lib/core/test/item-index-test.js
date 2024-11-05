// # item-index-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import { DBPF, FileType, ItemIndex } from 'sc4/core';
import { hex } from 'sc4/utils';
import resource from '#test/get-test-file.js';

describe('An item index subfile', function() {

	it('accepts a tract size in its constructor', function() {

		let index = new ItemIndex(64/4);
		expect(index.width).to.equal(1024);
		expect(index.depth).to.equal(1024);
		expect(index.tractWidth).to.equal(16);
		expect(index.tractDepth).to.equal(16);
		expect(index.tileWidth).to.equal(64);
		expect(index.tileDepth).to.equal(64);
		expect(index).to.have.length(0);

	});

	it('intializes all cells', function() {

		let index = new ItemIndex(256/4);
		expect(index.width).to.equal(4096);
		expect(index.depth).to.equal(4096);
		expect(index.tractWidth).to.equal(64);
		expect(index.tractDepth).to.equal(64);
		expect(index.tileWidth).to.equal(256);
		expect(index.tileDepth).to.equal(256);
		expect(index).to.have.length(0);

		index.fill();
		expect(index).to.have.length(192);
		for (let column of index) {
			expect(column).to.have.length(192);
		}

	});

	it('rebuilds the index from a subfile', function() {

		const type = 0xabcd;
		let index = new ItemIndex().fill();
		let arr = [
			{
				get type() { return type; },
				mem: 0xffffffff,
				xMinTract: 0x40,
				xMaxTract: 0x42,
				zMinTract: 0x44,
				zMaxTract: 0x45,
			},
		];
		arr.type = type;

		// Add the item to index and check it's properly present.
		index.add(arr[0]);
		for (let x = 0x40; x <= 0x42; x++) {
			for (let z = 0x44; z <= 0x45; z++) {
				let cell = index[x][z];
				expect(cell).to.have.length(1);
				expect(+cell[0]).to.equal(arr[0].mem);
				expect(cell[0].type).to.equal(arr.type);
			}
		}

		// Rebuild the index. The item should still only be present once.
		index.rebuild(arr);
		for (let x = 0x40; x <= 0x42; x++) {
			for (let z = 0x44; z <= 0x45; z++) {
				let cell = index[x][z];
				expect(cell).to.have.length(1);
				expect(+cell[0]).to.equal(arr[0].mem);
				expect(cell[0].type).to.equal(arr.type);
			}
		}

	});

	it('should be parsed & serialized correctly', function() {

		let file = resource('City - RCI.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find(x => x.type === FileType.ItemIndexFile);
		let indexFile = entry.read();

		expect(indexFile.width).to.equal(1024);
		expect(indexFile.depth).to.equal(1024);
		expect(indexFile.tractWidth).to.equal(16);
		expect(indexFile.tractDepth).to.equal(16);
		expect(indexFile.tileWidth).to.equal(64);
		expect(indexFile.tileDepth).to.equal(64);
		expect(indexFile).to.have.length(192);
		for (let column of indexFile) {
			expect(column).to.have.length(192);
			for (let cell of column) {
				for (let ptr of cell) {
					expect(+ptr).to.be.a('number');
					expect(ptr).to.have.property('address');
					expect(ptr).to.have.property('type');
				}
			}
		}

		// Now serialize again. We haven't modified anything so everything 
		// should still match.
		let source = entry.decompress();
		let check = indexFile.toBuffer();
		expect(source.toString('hex')).to.equal(check.toString('hex'));

		// Seems that the item index works with tracts and that it only starts 
		// at 64. So a lot of the items is apparently never used. Probably 
		// related to the data structure I guess.
		let cells = [...indexFile.flat()].filter(x => x.length);
		let all = [];
		for (let cell of cells) {
			all.push(...cell);
		}
		let types = {};
		for (let item of all) {
			types[hex(item.type)] = true;
		}
		// console.log(...Object.keys(types).map(x => x.slice(2)));
		// let coords = cells.map(cell => [cell.x, cell.z]);
		// console.log(Math.max(...coords.map(x => x[0])));
		// console.log(Math.max(...coords.map(x => x[1])));
		// let tract = indexFile.columns[64][64];
		// console.log(tract.map(x => ({
		// 	"mem": hex(x.mem),
		// 	"type": hex(x.type)
		// })));

	});

});
