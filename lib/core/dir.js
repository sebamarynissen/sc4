// # dir.js
import { FileType } from './enums.js';

// # DIR
// A class representing a DatabaseDirectoryFile, more commonly known as a DIR 
// record.
export default class DIR extends Array {

	static [Symbol.for('sc4.type')] = FileType.DIR;

	// ## parse(rs, opts)
	parse(rs, opts = {}) {

		// In DBPF 7.1, DIR records have a length of 20 bytes. This is normally 
		// not used in SimCity 4, but we still support it though.
		let { entry = {} } = opts;
		let { dbpf = null } = entry;
		let major = dbpf?.header.indexMajor ?? 7;
		let minor = dbpf?.header.indexMinor ?? 0;
		let shouldSkip = major === 7 && minor > 1;

		// Reset our length and then read in the entire DIR record.
		this.length = 0;
		while (!rs.eof(entry.fileSize)) {
			let type = rs.uint32();
			let group = rs.uint32();
			let instance = rs.uint32();
			let size = rs.uint32();
			if (shouldSkip) rs.skip(4);
			this.push({ type, group, instance, size });
		}
		return this;

	}

}
