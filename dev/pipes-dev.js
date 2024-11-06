// # pipes-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import path from 'node:path';
import {
	Savegame,
	DBPF,
	FileType,
	Pipe,
	Pointer,
	Vertex,
	Color,
} from 'sc4/core';
import { chunk, getCityPath } from 'sc4/utils';
import resource from '#test/get-test-file.js';
import PipeManager from '../lib/api/pipe-manager.js';

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

	it.skip('generates a straight section of pipes', async function() {
		
		// Open the city and then clear the current pipes.
		// const out = getCityPath('Pipes');
		const out = getCityPath('Hilly Skyline');
		// let dbpf = this.open(getTestFile('City - Single Pipe.sc4'));
		let dbpf = this.open(resource('City - Hilly skyline.sc4'));
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
