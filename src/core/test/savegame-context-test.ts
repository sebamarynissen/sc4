// # savegame-context-test.ts
import { expect } from 'chai';
import Savegame from '../savegame.js';
import { resource } from '#test/files.js';
import Pointer from '../pointer.js';
import FileType from '../file-types.js';
import Lot from '../lot.js';
import { readRecordsAsBuffers } from '../helpers.js';
import { SmartBuffer } from 'smart-arraybuffer';
import { compareUint8Arrays } from 'uint8array-extras';

describe('A savegame context', function() {

	it('dereferences poitners to decoded subfiles', function() {

		let dbpf = new Savegame(resource('City - RCI.sc4'));
		let ctx = dbpf.createContext();
		let lot = ctx.deref(new Pointer(FileType.Lot, 0x034b0014));
		expect(lot).to.be.ok;
		expect(lot).to.be.an.instanceOf(Lot);

	});

	it('dereferences pointers to uncdecoded subfiles', function() {

		let dbpf = new Savegame(resource('City - RCI.sc4'));
		let entry = dbpf.find({ type: 0x8990c09a })!;
		let ctx = dbpf.createContext();
		let [buffer] = readRecordsAsBuffers(entry);
		let pointer = new Pointer<Uint8Array>(0x8990c09a, SmartBuffer.fromBuffer(buffer).readUInt32LE(8));
		let deref = ctx.deref(pointer);
		expect(compareUint8Arrays(deref, buffer)).to.equal(0);

	});

});
