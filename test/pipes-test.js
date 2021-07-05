// # pipes-test.js
'use strict';
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { Savegame, DBPF } = require('sc4');
const FileType = require('../lib/file-types.js');
const Pipe = require('../lib/pipe.js');
const { chunk, getCityPath } = require('../lib/util.js');

describe('The pipes subfile', function() {

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

	it('generates a pipe network', async function() {

		// let file = path.resolve(__dirname, 'files/City - Single Pipe.sc4');
		// let file = path.resolve(__dirname, 'files/City - Pipes.sc4');
		// let file = getCityPath('Piped');
		let file = getCityPath('New Delphina', 'New Delphina');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { pipes, itemIndex } = dbpf;
		let entry = dbpf.plumbingSimulator;
		console.table([entry.unknown]);

		return;

		let [original] = pipes;

		pipes.length = 0;

		const float = x => {
			let arr = new Float32Array(x);
			arr[0] = x;
			return arr[0];
		};

		let grid = dbpf.getSimGrid(FileType.SimGridUint8, 0x49d5bb8c);

		// Clear all pipes so we can generate new ones.
		// pipes.length = 0;
		let x0 = 3*16;
		let z0 = 6*16;
		let max = 64-2*3;
		let mem = 0;
		for (let j = 0; j < 9; j++) {
			let z = z0 + 7*16*j;
			for (let i = 0; i < max; i++) {
				let x = x0 + 16*i;
				let tile = new Pipe({
					mem: 10+(mem++),
					xMinTract: 0x40 + Math.floor(x / 64),
					xMaxTract: 0x40 + Math.floor(x / 64),
					zMinTract: 0x40 + Math.floor(z / 64),
					zMaxTract: 0x40 + Math.floor(z / 64),
					xMin: x,
					xMax: x+8,
					zMin: z,
					zMax: z+8,
					yMin: float(270-10.2),
					yMax: float(270-10.2+8.8),
					// textureId: 0x100,
					textureId: (i === 0 || i+1 === max) ? 0x00000300 : 0x00004b00,
					x: x,
					y: float(270-10.2),
					z: z+16,
					x2: x+16,
					y2: float(270-10.2),
					z2: z+16,
					x3: x+16,
					y3: float(270-10.2),
					z3: z,
					orientation: 1,
					westConnection: 0,
					eastConnection: 0,
					xMin2: x,
					xMax2: x+16,
					yMin2: float(270-10.2),
					yMax2: 270,
					zMin2: z,
					zMax2: z+16,
					blocks: 0,
					y4: 270,
					y5: 270,
					y6: 270,
					y7: 270,
				});
				tile.matrix.position = [x+8, 270-1.4, z+8];
				if (i === 0) {
					tile.matrix.ex = [0, 0, -1];
					tile.matrix.ey = [0, 1, 0];
					tile.matrix.ez = [1, 0, 0];
				} else {
					tile.matrix.ex = [0, 0, 1];
					tile.matrix.ey = [0, 1, 0];
					tile.matrix.ez = [-1, 0, 0];
				}
				let rgb = { r: 0xff, g: 0xff, b: 0xff, b: 0x80 };
				tile.sideTextures[4] = [
					{ x: x, y: 270-10.2, z: z, u: 0, v: 0, ...rgb },
					{ x: x, y: 270-10.2, z: z+16, u: 1, v: 0, ...rgb },
					{ x: x+16, y: 270-10.2, z: z+16, u: 1, v: 1, ...rgb },
					{ x: x+16, y: 270-10.2, z: z, u: 0, v: 1, ...rgb },
				];
				pipes.push(tile);

			}

		}

		// console.table([original, tile], Object.keys(tile).filter(key => key !== 'sideTextures' && key !== 'matrix'));
		// console.table([original.matrix, tile.matrix]);
		// console.table([original.unknown, tile.unknown]);

		// Rebuild the item index with our pipes network that we've created.
		itemIndex.rebuild(pipes);

		// At last update the com serializer.
		let com = dbpf.COMSerializerFile;
		com.set(FileType.PipeFile, pipes.length);

		await dbpf.save(getCityPath('Pipes', 'Experiments'));

	});

});
