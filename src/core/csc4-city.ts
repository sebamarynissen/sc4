// # csc4-city.ts
import type { dword, float } from 'sc4/types';
import FileType from './file-types.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import Unknown from './unknown.js';
import type Pointer from './pointer.js';
import { getJulianFromUnix, getUnixFromJulian } from 'sc4/utils';
import WriteBuffer from './write-buffer.js';

export default class cSC4City {
	static [kFileType] = FileType.cSC4City;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version = '12.2';

	// Note: the date below is apparently not the current date in the city, 
	// that's found in the cSC4Simulator subfile. Looks like this is the last 
	// date when something significantly changed in the city (something was 
	// plopped, etc.)
	date = new Date('2000-01-01T12:00:00Z');
	name = '';
	originalName = '';
	mayor = '';
	anotherName = '';
	physicalSize = [1024, 1024];
	physicalTileSize = [16, 16];
	tilesPerMeter: [float, float] = [1/16, 1/16];
	size: [number, number] = [0x40, 0x40];
	pointers: Pointer[] = [];
	u = new Unknown()
		.dword(0x00000000)
		.dword(0xeeae77d9)
		.dword(0x00000000)
		.dword(0x00000001)
		.dword(54)
		.dword(0x00000001)
		.dword(54)
		.word(0x0001)
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x42F41EB8)
		.dword(0x4217A3D7)
		.float(46)
		.dword(0x00000000)
		.byte(0x01);
		
	parse(rs: Stream) {
		this.u = new Unknown();
		let unknown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.version(2);
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.repeat(4, u => u.dword());
		this.date = new Date(getUnixFromJulian(rs.dword()));
		unknown.word();
		this.name = rs.string();
		this.originalName = rs.string();
		this.mayor = rs.string();
		this.anotherName = rs.string();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.float();
		unknown.dword();
		this.physicalSize = [rs.float(), rs.float()];
		this.physicalTileSize = [rs.float(), rs.float()];
		this.tilesPerMeter = [rs.float(), rs.float()];
		this.size = [rs.dword(), rs.dword()];

		// Next follow 53 pointers, probably all in a fixed order, pointing to 
		// other data structures. For now we just read them in as an array.
		this.pointers = [];
		for (let i = 0; i < 53; i++) {
			this.pointers.push(rs.pointer()!);
		}
		unknown.byte();
		rs.assert();
	}
	toBuffer() {
		let ws = new WriteBuffer();
		let unknown = this.u.writer(ws);
		ws.dword(this.mem);
		ws.version(this.version);
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.repeat(4, u => u.dword());
		ws.dword(getJulianFromUnix(this.date));
		unknown.word();
		ws.string(this.name);
		ws.string(this.originalName);
		ws.string(this.mayor);
		ws.string(this.anotherName);
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.float();
		unknown.dword();
		ws.tuple(this.physicalSize, ws.float);
		ws.tuple(this.physicalTileSize, ws.float);
		ws.tuple(this.tilesPerMeter, ws.float);
		ws.tuple(this.size, ws.dword);
		for (let pointer of this.pointers) {
			ws.pointer(pointer);
		}
		unknown.byte();
		return ws.seal();
	}
}
