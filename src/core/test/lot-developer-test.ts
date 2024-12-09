// # lot-developer-test.ts
import { expect } from 'chai';
import { SmartBuffer } from 'smart-arraybuffer';
import fs from '#test/fs.js';
import { Savegame, FileType } from 'sc4/core';
import { resource } from '#test/files.js';

describe('The LotDeveloper Subfile', function() {

	it('should read small city tiles', function() {
		let file = resource('city - RCI.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let { buildings } = dbpf;
		let entry = dbpf.find({ type: FileType.LotDeveloper });
		let dev = entry!.read();
		expect(dev.tileSize).to.equal(64+1);
		expect(dev.buildings).to.have.length(buildings.length);

		let crc = dev.crc;
		let buff = SmartBuffer.fromBuffer(dev.toBuffer());
		expect(buff.readUInt32LE(4)).to.equal(crc);

		// Seems to be something like this:
		// DWORD	Size
		// DWORD	CRC
		// DWORD	Mem
		// WORD	Version
		// DWORD 	City size + 1
		// DWORD	Unknown (seen 0x44800000 and 0x45800000)
		// DWORD	Unknown (seen 0x44800000 and 0x45800000)
		// DWORD	Count (= amount of buildings in the city)
		// 	DWORD	Building pointer
		// 	DWORD	Building type id (0xa9bd882d)
		// DWORD	Unknown (seen 0x00000000)
		// WORD	Unknown (seen 0x00000000)

	});

	it('should read medium city tiles', function() {
		let file = resource('City - Medium.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let { buildings } = dbpf;
		let entry = dbpf.find({ type: FileType.LotDeveloper });
		let dev = entry!.read();
		expect(dev.tileSize).to.equal(128+1);
		expect(dev.buildings).to.have.length(buildings.length);

		let crc = dev.crc;
		let buff = SmartBuffer.fromBuffer(dev.toBuffer());
		expect(buff.readUInt32LE(4)).to.equal(crc);

	});

	it('should read large city tiles', function() {
		let file = resource('city.sc4');
		let dbpf = new Savegame(fs.readFileSync(file));

		let { buildings } = dbpf;
		let entry = dbpf.find({ type: FileType.LotDeveloper });
		let dev = entry!.read();
		expect(dev.tileSize).to.equal(256+1);
		expect(dev.buildings).to.have.length(buildings.length);

		let crc = dev.crc;
		let buff = SmartBuffer.fromBuffer(dev.toBuffer());
		expect(buff.readUInt32LE(4)).to.equal(crc);

	});

});
