// # pipes-test.js
'use strict';
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { Savegame, DBPF } = require('sc4');
const FileType = require('../lib/file-types.js');
const Pipe = require('../lib/pipe.js');
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

	it.only('is parsed correctly & serialized correctly', function() {

		let file = path.resolve(__dirname, 'files/City - Pipes.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new DBPF(buffer);

		let entry = dbpf.find(0x49c05b9f);
		let raw = entry.decompress();
		let pipes = entry.read();
		let out = pipes.toBuffer();
		expect(Buffer.compare(out, raw)).to.equal(0);

	});

	it.only('generates a straight section of pipes', async function() {
		
		// Open the city and then clear the current pipes.
		let dbpf = this.open(getTestFile('City - Single Pipe.sc4'));
		let { pipes, plumbingSimulator: sim } = dbpf;
		pipes.length = 0;
		sim.clear();

		let a = 3;
		let mem = 10;
		let h = 270;
		for (let j = 6; j < 64; j += 13) {
			for (let i = a; i < 61; i++) {

				// Calculate the metric x and z positions.
				let x = 16*i;
				let z = 16*j;
				let xTract = 0x40 + Math.floor(i/4);
				let zTract = 0x40 + Math.floor(j/4);

				// Create the pipe tile and position it correctly first.
				let pipe = new Pipe({
					mem: mem++,
					xMinTract: xTract,
					xMaxTract: xTract,
					zMinTract: zTract,
					zMaxTract: zTract,
					x: x+8,
					y: h-1.4,
					z: z+8,
					xMin: x,
					xMax: x+16,
					yMin: h-10.2,
					yMax: h,
					zMin: z,
					zMax: z+16,
					xTile: i,
					zTile: j,
				});
				pipe.yNW = pipe.yNE = pipe.ySW = pipe.ySE = h;
				pipe.yModel = pipe.y;

				// Set the bottom vertices & bottom texture.
				for (let i = 0; i < 2; i++) {
					for (let j = 0; j < 2; j++) {
						let index = 2*i+j;
						let v = pipe.vertices[index];
						v.x = x+16*i;
						v.y = h-10.2;
						v.z = z+16*(i !== j);
						v.u = i;
						v.v = +(i !== j);
					}
				}
				pipe.sideTextures.bottom = pipe.vertices.map(vertex => {
					let fresh = Object.assign(new Vertex(), vertex);
					fresh.color = new Color(0xff, 0xff, 0xff, 0x80);
					return fresh;
				});

				// Create the sides of the hole now.
				let lines = [
					[[i, j], [i+1, j]],
					[[i, j+1], [i+1, j+1]],
				];
				for (let line of lines) {
					for (let i = 0; i < 2; i++) {
						for (let j = 0; j < 2; j++) {
							let vertex = new Vertex();
							let point = line[i];
							vertex.x = 16*point[0];
							vertex.y = h - (i !== j)*10.2;
							vertex.z = 16*point[1];
							vertex.u = i;
							vertex.v = i !== j ? 0.6375007629394531 : 0;
							vertex.color = new Color(0xff, 0xff, 0xff, 0x80);
							pipe.sideTextures[0].push(vertex);
						}
					}
					pipe.blocks++;
				}

				// Insert the prop model at the correct position.
				pipe.textureId = 0x00004b00;
				pipe.matrix.position = [pipe.x, pipe.y, pipe.z];
				pipe.matrix.ex = [0, 0, 1];
				pipe.matrix.ez = [-1, 0, 0];
				pipe.orientation = 1;

				// Set the connections.
				pipe.eastConnection = 0x02;
				pipe.westConnection = 0x02;

				// Based on the connections, determine what value to set in 
				// the plumbing simulator.
				let base = 0b10000;
				if (pipe.westConnection) base ^= 0b0001;
				if (pipe.eastConnection) base ^= 0b0100;
				if (pipe.northConnection) base ^= 0b0010;
				if (pipe.southConnection) base ^= 0b1000;
				sim.cells[j][i] = base;

				// At last insert the pipe.
				pipes.push(pipe);
				sim.pipes.push(new Pointer(pipe));

			}
		}

		// Now rebuild the item index and store in the com serializer.
		// console.table(pipes, getKeys(pipes));
		// console.table(pipes[0].vertices);
		// console.table(pipes[0].sideTextures[4]);
		sim.revision++;
		dbpf.itemIndex.rebuild(pipes);
		dbpf.COMSerializerFile.set(FileType.PipeFile, pipes.length);
		await dbpf.save(getCityPath('Pipes'));

	});

	it.only('plays with some values', async function() {

		// let dbpf = this.open(getTestFile('City - Single Pipe.sc4'));
		let dbpf = this.open(getCityPath('Piped'));
		// let dbpf = this.open(getCityPath('New Sebastia', 'New Delphina'));
		let { pipes } = dbpf;
		// console.table(pipes[0].sideTextures[1]);
		// console.log(dbpf.plumbingSimulator.cells);
		// console.table(pipes, getKeys(dbpf.pipes));
		// console.table(pipes[0].vertices);
		// console.table(pipes[0].sideTextures[4]);

		// await dbpf.save(getCityPath('Pipes'));

	});

});
