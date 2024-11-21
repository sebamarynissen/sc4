// # lot-developer-file.js
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';

// # LotDeveloperFile
export default class LotDeveloperFile {

	static [Symbol.for('sc4.type')] = FileType.LotDeveloperFile;

	// ## constructor()
	constructor() {
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0001;
		this.tileSize = 0x00000041;
		this.width = 0x44800000;
		this.depth = 0x44800000;
		this.buildings = [];
		this.u3 = 0x00000000;
		this.u4 = 0x0000;
	}

	// ## parse(buff)
	parse(buff) {
		let rs = new Stream(buff);
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.tileSize = rs.dword();
		this.width = rs.float();
		this.depth = rs.float();

		// Read in the entries.
		let count = rs.dword();
		this.buildings = new Array(count);
		for (let i = 0; i < count; i++) {
			this.buildings[i] = rs.pointer();
		}

		// Read in the rest.
		this.u3 = rs.dword();
		this.u4 = rs.word();

		// Check if we read everything correctly.
		if (size !== rs.i) {
			console.warn([
				'Error when reading LotDeveloper Subfile!',
				`Expected ${size} bytes, but read ${rs.i}.`,
			].join(' '));
		}

		return this;

	}

	// ## clear()
	// Clears the lot developer file again.
	clear() {
		this.buildings = [];
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.tileSize);
		ws.float(this.width);
		ws.float(this.depth);
		ws.dword(this.buildings.length);
		for (let building of this.buildings) {
			ws.pointer(building);
		}
		ws.dword(this.u3);
		ws.word(this.u4);
		return ws.seal();
	}

}
