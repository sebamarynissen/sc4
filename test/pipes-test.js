// # pipes-test.js
'use strict';
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { Savegame, DBPF } = require('sc4');
const FileType = require('../lib/file-types.js');
const Pipe = require('../lib/pipe.js');
const PipeManager = require('../lib/pipe-manager.js');
const Pointer = require('../lib/pointer.js');
const Vertex = require('../lib/vertex.js');
const Color = require('../lib/color.js');
const { chunk, getCityPath, getTestFile } = require('../lib/util.js');

describe('The pipes subfile', function() {

	before(function() {
		this.open = function(file) {
			let buffer = fs.readFileSync(file);
			return new Savegame(buffer);
		};
	});

	function getKeys(pipes) {
		return Object.keys(pipes[0]).filter(x => {
			return !'crc mem major minor xMinTract zMinTract xMaxTact zMaxTract GID TID IID matrix3 xTractSize zTractSize'.split(' ').includes(x);
			// return x.startsWith('x') || x.startsWith('z');
		});
	}

	it('is parsed correctly & serialized correctly', function() {

		let file = path.resolve(__dirname, 'files/City - Pipes.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new DBPF(buffer);

		let entry = dbpf.find(0x49c05b9f);
		let raw = entry.decompress();
		let pipes = entry.read();
		let out = pipes.toBuffer();
		expect(Buffer.compare(out, raw)).to.equal(0);

	});

	it.skip('generates a straight section of pipes', async function() {
		
		// Open the city and then clear the current pipes.
		// const out = getCityPath('Pipes');
		const out = getCityPath('Hilly Skyline');
		// let dbpf = this.open(getTestFile('City - Single Pipe.sc4'));
		let dbpf = this.open(getTestFile('City - Hilly skyline.sc4'));
		let mgr = new PipeManager(dbpf);
		mgr.applyOptimalLayout();
		await dbpf.save(out);

	});

	it.skip('plays with some values', async function() {

		// let dbpf = this.open(getTestFile('City - Single Pipe.sc4'));
		let dbpf = this.open(getCityPath('Piped'));
		// let dbpf = this.open(getCityPath('New Sebastia', 'New Delphina'));
		let { pipes } = dbpf;
		let pipe = pipes.find(pipe => pipe.xTile === 8);
		console.table([pipe], Object.keys(pipe).filter(key => key.startsWith('y')));
		console.table(pipe.vertices);
		console.log(pipe.matrix3);
		console.log(pipe.matrix);
		console.table(pipe.sideTextures.bottom);
		// console.table(pipes[0].sideTextures[1]);
		// console.log(dbpf.plumbingSimulator.cells);
		// console.table(pipes, getKeys(dbpf.pipes));
		// console.table(pipes[0].vertices);
		// console.table(pipes[0].sideTextures[4]);

		// await dbpf.save(getCityPath('Pipes'));

	});

});
