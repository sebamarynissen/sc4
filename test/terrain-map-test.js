// # terrain-map-test.js
'use strict';
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const TerrainMap = require('../lib/terrain-map.js');
const DBPF = require('../lib/dbpf.js');
const { FileType } = require('../lib/enums.js');

describe('The terrain map', function() {

	it('is be parsed & serialized correctly', function() {

		let file = path.resolve(__dirname, 'files/city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);
		let entry = dbpf.find(({ type, instance }) => {
			return type === FileType.TerrainMap && instance === 0x00000001;
		});
		let terrain = entry.read();
		expect(terrain.xSize).to.equal(257);
		expect(terrain.ySize).to.equal(257);
		expect(terrain).to.have.length(terrain.xSize);

		let source = entry.decompress();
		let check = terrain.toBuffer();
		expect(Buffer.compare(source, check)).to.equal(0);

	});

	it('serializes row-first', function() {

		let buff = Buffer.alloc(2+ 4*5**2);
		buff.writeUint16LE(0, 2);
		let terrain = new TerrainMap();
		terrain.parse(buff);
		terrain[1][0] = 10;

		let out = terrain.toBuffer();
		expect(out.readFloatLE(6)).to.equal(10);

	});

});
