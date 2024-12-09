// # zone-manager.js
import { hexToUint8Array } from 'uint8array-extras';
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import Pointer from './pointer.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';
import type { ConstructorOptions, dword } from 'sc4/types';

// Some type ids. We should put them within the FileType's though!
const cSC4SimGridSint8 = 0x49b9e603;
const cSC4City = 0x8990c372;
const cSC4OccupantManager = 0x098f964d;
const cSTETerrain = 0xe98f9525;
const cSC4PollutionSimulator = 0x8990c065;
const cSC4BudgetSimulator = 0xe990be01;

// # ZoneManager
// Not sure what it does yet, still decoding.
export default class ZoneManager {
	static [kFileType] = FileType.ZoneManager;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0001;

	// Pointer to the ZoneView grid.
	grid = new Pointer(cSC4SimGridSint8);
	u1: number[] = Array(16).fill(0x00000000);

	// Note even though the size is repeated multiple times when parsing, 
	// we'll only assign it once.
	size = 0x00000000;

	// From now on follows a part that always seems to be fixed.
	u2 = hexToUint8Array(fixed);

	// Pointers to other subfiles.
	city = new Pointer(cSC4City);
	occupantManager = new Pointer(cSC4OccupantManager);
	terrain = new Pointer(cSTETerrain);
	pollutionSimulator = new Pointer(cSC4PollutionSimulator);
	budgetSimulator = new Pointer(cSC4BudgetSimulator);

	// ## constructor(opts)
	constructor(opts?: ConstructorOptions<ZoneManager>) {
		Object.assign(this, opts);
	}

	// ## parse(buff)
	parse(buff: Stream | Uint8Array) {
		let rs = new Stream(buff);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.grid = rs.pointer() as Pointer;

		// Read in the unknowns.
		let arr: dword[] = this.u1 = [];
		for (let i = 0; i < 16; i++) {
			arr.push(rs.dword());
		}

		// Read in the size, but skip the fact that it's repeated.
		this.size = rs.dword();
		rs.skip(32*4);

		// Read in the next 533 bytes. Seems like they're always fixed.
		this.u2 = rs.read(533);

		// More pointers follow now.
		this.city = rs.pointer() as Pointer;
		this.occupantManager = rs.pointer() as Pointer;
		this.terrain = rs.pointer() as Pointer;
		this.pollutionSimulator = rs.pointer() as Pointer;
		this.budgetSimulator = rs.pointer() as Pointer;

	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.pointer(this.grid);
		for (let dword of this.u1) {
			ws.dword(dword);
		}
		for (let i = 0; i < 33; i++) {
			ws.dword(this.size);
		}
		ws.write(this.u2);
		ws.pointer(this.city);
		ws.pointer(this.occupantManager);
		ws.pointer(this.terrain);
		ws.pointer(this.pollutionSimulator);
		ws.pointer(this.budgetSimulator);
		return ws.seal();
	}

}

const fixed = `
00000000 00000000 00000000 00000000 01000000
01000000 01000000 01000000 01000000 01000000 04000000 01000000 01000000
01000000 01000000 01000000 01000000 02000000 01000000 00800000 20000000
20000000 20000000 20000000 20000000 20000000 30000000 20000000 20000000
20000000 20000000 20000000 20000000 20000000 20000000 00000000 00000000
0a000000 00000000 14000000 00000000 32000000 00000000 0a000000 00000000
14000000 00000000 32000000 00000000 0a000000 00000000 14000000 00000000
32000000 00000000 01000000 00000000 01000000 00000000 01000000 00000000
01000000 00000000 32000000 00000000 01000000 00000000 00000000 00000000
01000000 00000000 01000000 00000000 01000000 00000000 01000000 00000000
01000000 00000000 01000000 00000000 01000000 00000000 01000000 00000000
01000000 00000000 01000000 00000000 01000000 00000000 01000000 00000000
01000000 00000000 01000000 00000000 01000000 00000000 19100000 15100000
16100000 14100000 03100000 04100000 02100000 10100000 11100000 0f100000
12100000 00100000 18100000 1b100000 05100000 1a100000 ff0000ff ff00c400
ff009a00 ff007200 ffff774f ffff5320 ffe22014 ff32dbff ff33b2ff ff1f90ce
00000000 00000000 00000000 00000000 00000000 00000000 aa000000 00000000
00
`.replace(/( |\n)/g, '');
