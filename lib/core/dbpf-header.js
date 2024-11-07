// # dbpf-header.js
import WriteBuffer from './write-buffer.js';

// # Header
export default class Header {

	id = 'DBPF';
	majorVersion = 1;
	minorVersion = 0;
	created = new Date();
	modified = this.created;
	indexMajor = 7;
	indexCount = 0;
	indexOffset = 0;
	indexSize = 0;
	holesCount = 0;
	holesOffset = 0;
	holesSize = 0;
	indexMinor = 0;

	// ## parse(rs)
	parse(rs) {

		// if the DBPF file is not actually a DBPF file, we stop reading 
		// immediately.
		this.id = rs.string(4);
		if (this.id !== 'DBPF') {
			rs.skip(92);
			return this;
		}

		// Continue reading.
		this.majorVersion = rs.uint32();
		this.minorVersion = rs.uint32();
		rs.skip(12);
		this.created = new Date(1000*rs.uint32());
		this.modified = new Date(1000*rs.uint32());
		this.indexMajor = rs.uint32();

		// Read in where we can find the file index and the holes.
		this.indexCount = rs.uint32();
		this.indexOffset = rs.uint32();
		this.indexSize = rs.uint32();
		this.holesCount = rs.uint32();
		this.holesOffset = rs.uint32();
		this.holesSize = rs.uint32();
		this.indexMinor = rs.uint32();
		rs.skip(4);
		rs.skip(4);
		rs.skip(24);
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let buffer = new WriteBuffer({ size: 96 });
		buffer.string(this.id, { length: false });
		buffer.uint32(this.majorVersion);
		buffer.uint32(this.minorVersion);
		buffer.zeroes(12);
		buffer.uint32(this.created.getTime()/1000);
		buffer.uint32(this.modified.getTime()/1000);
		buffer.uint32(this.indexMajor);

		// Below we reserve 24 bytes for the index count, offset & size and the 
		// hole count, offset & size. These will be filled in later by the DBPF 
		// itself once their values are actually known.
		buffer.zeroes(24);
		buffer.uint32(this.indexMinor);
		buffer.uint32(0);
		buffer.zeroes(4);
		buffer.zeroes(24);
		return buffer.toBuffer();

	}

}
