// # index-test.js
"use strict";
const chai = require('chai');
const expect = chai.expect;
const path = require('path');

const Index = require('../lib/index');
const FileType = require('../lib/file-types');

describe('The file index', function() {

	it('should index all files in a directory', async function() {

		let index = new Index({
			"dirs": [
				path.resolve(__dirname, 'files/DarkNight_11KingStreetWest')
			]
		});

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

	});

});