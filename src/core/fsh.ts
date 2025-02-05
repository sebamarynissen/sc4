// # fsh.ts
import FileType from './file-types.js';
import Stream from './stream.js';
import { kFileType } from './symbols.js';

// # FSH
// A parser for the FSH format. Note that by default we don't decompress the 
// images contained in it. We only parse all "entries" in the FSH, and if you 
// want to get the raw decompressed data, you'll have to call the `decompress()` 
// method on this.
export default class FSH {
	static [kFileType] = FileType.FSH;
	size = 0;
	directoryId = '';
	entries: FSHEntry[] = [];
	parse(rs: Stream) {
		const id = rs.string(4);
		if (id !== 'SHPI') {
			throw new Error('Invalid FSH file');
		}
		this.size = rs.uint32();
		const numImages = rs.uint32();
		this.directoryId = rs.string(4);

		// Read in the directory.
		const index: ({ name: string, offset: number })[] = [];
		for (let i = 0; i < numImages; i++) {
			const name = rs.string(4);
			const offset = rs.uint32();
			index.push({ name, offset });
		}

		// From the directory, we can read in all entries.
		this.entries = [];
		for (let { name, offset } of index) {
			let entry = new FSHEntry({ name });
			let stream = new Stream(rs.internalUint8Array.subarray(offset));
			entry.parse(stream);
			this.entries.push(entry);
		}
		return this;

	}
}

type FSHEntryOptions = {
	name?: string;
};

class FSHEntry {
	name = '0000';
	id = 0x00;
	size = 0;
	width = 0;
	height = 0;
	center = [0, 0];
	offset = [0, 0];
	image: FSHImageData;
	mipmaps: FSHImageData[] = [];
	constructor(opts: FSHEntryOptions) {
		this.name = opts.name ?? '0000';
	}
	parse(rs: Stream) {
		this.id = rs.byte();
		this.size = rs.byte() + (rs.byte() << 8) + (rs.byte() << 16);
		let width = this.width = rs.uint16();
		let height = this.height = rs.uint16();
		this.center = [rs.uint16(), rs.uint16()];
		let ox = rs.uint16();
		let oy = rs.uint16();
		this.offset = [(ox & 0xffffff) >>> 0, (oy & 0xffffff) >>> 0]

		// The size of the image data that follows depends on the id of the 
		// entry.
		let code = this.id & 0x7f;
		this.image = new FSHImageData({
			code,
			width,
			height,
			data: readBufferByCode(rs, code, width, height),
		});

		// Read in all mimmaps too.
		let numMipMaps = oy >>> 24;
		this.mipmaps = [];
		for (let i = 0; i < numMipMaps; i++) {
			let factor = 2**(i+1);
			let width = this.width/factor;
			let height = this.height/factor;
			let mipmap = new FSHImageData({
				code,
				width,
				height,
				data: readBufferByCode(rs, code, width, height),
			});
			this.mipmaps.push(mipmap);
		}
		return this;

	}
}

function readBufferByCode(rs: Stream, code: number, width: number, height: number) {
	switch (code) {
		case 0x60:
		case 0x61:
			return rs.readUint8Array(width*height/2);
		default:
			throw new Error(`Unknown FSH code 0x${code.toString(16)}!`);
	}
}

type FSHImageDataOptions = {
	code: number;
	width: number;
	height: number;
	data: Uint8Array;
};

// # FSHImageData
// The FSHImageData class contains the raw, encoded and potentially compressed 
// image data. This is the entry point for actually
class FSHImageData {
	code = 0x00;
	data: Uint8Array;
	width = 0;
	height = 0;
	constructor(opts: FSHImageDataOptions) {
		this.code = opts.code;
		this.width = opts.width;
		this.height = opts.height;
		this.data = opts.data;
	}
}
