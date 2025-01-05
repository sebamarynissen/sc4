// # helpers-test.ts
import { expect } from 'chai';
import { readRecordsAsBuffers } from '../helpers.js';
import Savegame from '../savegame.js';
import { resource } from '#test/files.js';
import FileType from '../file-types.js';
import { compareUint8Arrays } from 'uint8array-extras';

describe('The core helpers', function() {

	describe('#readRecordsAsBuffers()', function() {

		it('properly splits up a file consisting of multiple records', function() {

			this.slow(500);
			let dbpf = new Savegame(resource('City - Large developed.sc4'));
			let entry = dbpf.find({ type: FileType.Lot })!;
			let buffers = readRecordsAsBuffers(entry);
			let lots = entry.read();
			for (let i = 0; i < buffers.length; i++) {
				expect(compareUint8Arrays(buffers[i], lots[i].toBuffer())).to.equal(0);
			}

		});

	});

});
