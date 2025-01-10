// # helpers-test.ts
import { expect } from 'chai';
import { readRecordsAsBuffers, removePointers } from '../helpers.js';
import Savegame from '../savegame.js';
import { resource } from '#test/files.js';
import FileType from '../file-types.js';
import { compareUint8Arrays } from 'uint8array-extras';
import WriteBuffer from '../write-buffer.js';
import Pointer from '../pointer.js';

describe('The core helpers', function() {

	describe('#readRecordsAsBuffers()', function() {

		it('properly splits up a file consisting of multiple records', function() {

			this.slow(500);
			let dbpf = new Savegame(resource('City - Large developed.sc4'));
			let entry = dbpf.find({ type: FileType.Lot })!;
			let raw = entry.decompress();
			let buffers = readRecordsAsBuffers(raw);
			let lots = entry.read();
			for (let i = 0; i < buffers.length; i++) {
				let buffer = buffers[i];
				expect(buffer.buffer).to.equal(raw.buffer);
				expect(compareUint8Arrays(buffer, lots[i].toBuffer())).to.equal(0);
			}

		});

	});

	describe('#removePointers()', function() {

		it('removes all memory addresses from a record buffer', function() {

			let ws = new WriteBuffer();
			ws.word(0x0002);
			ws.pointer(new Pointer(FileType.Lot, 0x01234567));
			ws.float(Math.PI);
			ws.byte(0xff);
			ws.pointer(new Pointer(FileType.Prop, 0xabcdefaa));
			let buffer = ws.toUint8Array();
			let clone = new Uint8Array(buffer);
			removePointers(buffer);
			clone.set([0, 0, 0, 0], 2);
			clone.set([0, 0, 0, 0], 15);
			expect(buffer).to.eql(clone);

		});

	});

});
