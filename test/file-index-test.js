// # file-index-test.js
'use strict';
const path = require('path');
const { expect } = require('chai');
const Index = require('../lib/file-index.js');
const FileType = require('../lib/file-types.js');
const dir = path.join(__dirname, 'files');

describe('The file index', function() {

	it('should index all files in a directory', async function() {

		let index = new Index(
			path.resolve(__dirname, 'files/DarkNight_11KingStreetWest'),
		);

		// Build up the index. This is done asynchronously so that files can 
		// be read in parallel while parsing.
		await index.build();

		let record = index.find(0x6534284a, 0xa8fbd372, 0xe001a291);
		expect(record).to.be.ok;
		expect(record.fileSize).to.equal(2378);
		expect(record.compressedSize).to.equal(2378);
		expect(record.compressed).to.be.false;

		// Read the file. Should be an exemplar.
		let file = record.read();
		expect(file.fileType).to.equal(FileType.Exemplar);
		expect(file.table).to.have.property('LotConfigPropertyLotObject');
		expect(file.table).to.have.property(0x88EDC900);

		let building = file.lotObjects.find(x => x.type === 0x00);
		expect(building.x).to.equal(1);
		expect(building.y).to.equal(0);
		expect(building.z).to.equal(1.5);

	});

	it('uses a memory limit for the cache', async function() {

		let nybt = path.join(dir, 'NYBT/Aaron Graham/NYBT Gracie Manor');
		let index = new Index({
			dirs: [nybt],
			mem: 1500000,
		});
		await index.build();
		for (let entry of index.records) {
			entry.read();
		}

	});

	it('indexes all building and prop families', async function() {

		let nybt = path.join(dir, 'NYBT/Aaron Graham/NYBT Gracie Manor');
		let index = new Index(nybt);
		await index.build();
		let { families } = index;
		expect(families).to.have.length(2);
		expect(index.family(0x5484CA20)).to.have.length(4);
		expect(index.family(0x5484CA1F)).to.have.length(4);

	});

});
