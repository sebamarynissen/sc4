// # lot-test.js
import { expect } from 'chai';
import { DBPF, Savegame, FileType, ZoneType } from 'sc4/core';
import { SmartBuffer } from 'smart-arraybuffer';
import { compareUint8Arrays } from 'uint8array-extras';
import fs from '#test/fs.js';
import { resource, output } from '#test/files.js';

describe('A lot subfile', function() {

	it('is parsed & serialized correctly', function() {

		let dbpf = new Savegame(resource('city.sc4'));

		let entry = dbpf.entries.find({ type: FileType.Lot });
		let lots = entry.read();

		// Check the crc checksums. We didn't modify the lot, so they should 
		// still match. This also ensures that the serialization process is 
		// correct as well!
		for (let lot of lots) {

			// Note: toBuffer() updates the crc, so make sure to grab the old 
			// one!
			let crc = lot.crc;
			let buff = SmartBuffer.fromBuffer(lot.toBuffer());
			expect(buff.readUInt32LE(4)).to.equal(crc);

		}

		// Serialize the building file right away. Should result in exactly 
		// the same buffer.
		let source = entry.decompress();
		let check = entry.toBuffer();
		expect(compareUint8Arrays(source, check)).to.equal(0);

	});

	it('detects Residential, Commercial, Agricultural & Industry correctly', function() {
		let dbpf = new Savegame(resource('City - RCI.sc4'));

		// Get the lotfile.
		let { lots } = dbpf;
		expect(lots[0].isResidential).to.be.true;
		expect(lots[1].isIndustrial).to.be.true;
		expect(lots[2].isAgricultural).to.be.true;
		expect(lots[2].isIndustrial).to.be.false;
		expect(lots[3].isCommercial).to.be.true;

	});

	it('re-saves after making buildings historical', async function() {
		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		// Mark all lots as historical.
		let entry = dbpf.entries.find({ type: FileType.Lot });
		let lots = entry.read();
		for (let lot of lots) {
			expect(lot.historical).to.be.false;
			lot.historical = true;
			expect(lot.historical).to.be.true;
		}

		// Save baby. Oh boy oh boy.
		let to = output('writing_true_history.sc4');
		await dbpf.save({ file: to });

		// Now hand-test this in SC4.

	});

	it('changes a plopped building into a grown one', async function() {

		let file = resource('plopped.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		// Read the lots
		let entry = dbpf.entries.find({ type: FileType.Lot });
		let lots = entry.read();
		let plopped = lots[26];

		plopped.zoneType = 0x01;
		// console.log(hex(plopped.zoneType));
		// console.log(lots)
		// lots[1].zoneType = lots[0].zoneType;

		// Save again.
		let to = output('plopped-mod.sc4');
		await dbpf.save({ file: to });

	});

	it('checks for plopped residentials', function() {

		let file = resource('city.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find({ type: FileType.Lot });
		let lots = entry.read();

		for (let lot of lots) {
			expect(lot.isPloppedResidential).to.be.false;
			if (lot.isResidential) {
				lot.zoneType = 0x0f;
				expect(lot.isPloppedResidential).to.be.true;
			}
		}

	});

	it('moves a lot under a bridge', async function() {
		let file = resource('dumbo-offset.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find({ type: FileType.Lot });
		let lots = entry.read();

		let lot = lots[0];
		lot.minZ += 3;
		lot.maxZ += 3;

		let to = output('dumbo-mod.sc4');
		await dbpf.save({ file: to });

	});

	it('growifies industry', async function() {
		let file = resource('City - Plopped Industry - source.sc4');
		let buff = fs.readFileSync(file);
		let dbpf = new DBPF(buff);

		let entry = dbpf.entries.find({ type: FileType.Lot });
		let lots = entry.read();

		let lot = lots[0];
		expect(lot.isPloppedIndustrial).to.be.true;

		// Now change it and check in SC4.
		lot.zoneType = ZoneType.IMedium;

		let to = output('City - Plopped Industry.sc4');
		await dbpf.save({ file: to });

		// It works!

	});

});
