// # pipes-test.js
'use strict';
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const { Savegame, DBPF } = require('sc4');
const FileType = require('../lib/file-types.js');
const Pipe = require('../lib/pipe.js');
const { getCityPath } = require('../lib/util.js');

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

		let file = path.resolve(__dirname, 'files/City - Single Pipe.sc4');
		let buffer = fs.readFileSync(file);
		let dbpf = new Savegame(buffer);
		let { pipes, itemIndex } = dbpf;
		let [original] = pipes;

		pipes.length = 0;

		const float = x => {
			let arr = new Float32Array(x);
			arr[0] = x;
			return arr[0];
		};

		// Clear all pipes so we can generate new ones.
		// pipes.length = 0;

		let dh = 0;
		let tile = new Pipe({
			mem: 10,
			xMinTract: 0x40,
			xMaxTract: 0x40,
			zMinTract: 0x40,
			zMaxTract: 0x40,
			xMin: 16,
			xMax: 16+8,
			zMin: 16,
			zMax: 16+8,
			yMin: float(270-10.2),
			yMax: float(270-1.4),
			textureId: 0x100,
			x: 16,
			y: float(270-10.2)+10,
			z: 32,
			x2: 32,
			y2: float(270-10.2)+10,
			z2: 32,
			x3: 32,
			y3: float(270-10.2)+10,
			z3: 16,
			orientation: 0,
			westConnection: 0,
			eastConnection: 0,
			xMin2: 16,
			xMax2: 32,
			yMin2: float(270-10.2)+10,
			yMax2: 270,
			zMin2: 16,
			zMax2: 32,
			blocks: 4,
			y5: 270,
			y6: 270,
			y7: 270,
			y8: 270,
			sideTextures: original.sideTextures,
		});
		tile.matrix.position = [16+8, 270-1.4, 16+8];
		pipes.push(tile);

		// console.table([original.matrix, tile.matrix]);

		// console.table([original, tile], ['y', 'y2']);
		// console.table([original, tile], Object.keys(tile).filter(key => key !== 'sideTextures'));
		// console.table([original.unknown, tile.unknown]);

		// Rebuild the item index with our pipes network that we've created.
		itemIndex.rebuild(pipes);

		await dbpf.save(getCityPath('Pipes', 'Experiments'));

	});

});
