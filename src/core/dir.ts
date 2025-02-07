// # dir.ts
import type Entry from './dbpf-entry.js';
import { FileType } from './enums.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import WriteBuffer from './write-buffer.js';
import type TGI from './tgi.js';

type DirRecord = {
	tgi: TGI;
	size: number,
};

// # DIR
// A class representing a DatabaseDirectoryFile, more commonly known as a DIR 
// record.
export default class DIR extends Array<DirRecord> {
	static [kFileType] = FileType.DIR;

	// ## parse(rs, opts)
	parse(rs: Stream, opts: { entry?: Entry } = {}) {

		// In DBPF 7.1, DIR records have a length of 20 bytes. This is normally 
		// not used in SimCity 4, but we still support it though.
		let { entry = null } = opts;
		let major = entry?.dbpf?.header.indexMajor ?? 7;
		let minor = entry?.dbpf?.header.indexMinor ?? 0;
		let shouldSkip = major === 7 && minor > 1;

		// Reset our length and then read in the entire DIR record.
		this.length = 0;
		while (rs.remaining() > 0) {
			let tgi = rs.tgi();
			let size = rs.uint32();
			if (shouldSkip) rs.skip(4);
			this.push({ tgi, size });
		}
		return this;

	}

	// ## toBuffer(opts)
	toBuffer(opts: { major?: number, minor?: number } = {}) {
		let { major = 7, minor = 0 } = opts;
		let byteLength = major === 7 && minor > 1 ? 20 : 16;
		let ws = new WriteBuffer({ size: this.length*byteLength });
		for (let row of this) {
			ws.tgi(row.tgi);
			ws.uint32(row.size);
			if (byteLength === 20) ws.uint32(0);
		}
		return ws.toUint8Array();
	}

}
