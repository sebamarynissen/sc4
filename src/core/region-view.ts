// # region-view-file.js
import Stream from './stream.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';

// # RegionViewFile
export default class RegionViewFile {
	static [kFileType] = FileType.RegionViewFile;
	buffer: Uint8Array;
	major = 0x0001;
	minor = 0x000d;
	x = 0;
	z = 0;
	xSize = 0;
	zSize = 0;

	// ## parse(buff)
	parse(buff: Uint8Array) {
		this.buffer = buff;
		let rs = new Stream(this.buffer);

		// Partially read in. This stuff is pretty much read-only for now, no 
		// need to fully parse it yet.
		this.major = rs.word();
		this.minor = rs.word();
		this.x = rs.dword();
		this.z = rs.dword();
		this.xSize = rs.dword();
		this.zSize = rs.dword();

	}

	// ## toBuffer()
	toBuffer() {
		return this.buffer;
	}

}
