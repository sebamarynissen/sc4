// # fsh.ts
import FileType from './file-types.js';
import Stream from './stream.js';
import { kFileType } from './symbols.js';
import {
	decompress8bit,
	decompressDXT1,
	decompressDXT3,
} from './bitmap-decompression.js';

// # FSH
// A parser for the FSH format. Note that by default we don't decompress the 
// images contained in it. We only parse all "entries" in the FSH, and if you 
// want to get the raw decompressed data, you'll have to call the `decompress()` 
// method on this.
export class FSH {
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
	*[Symbol.iterator]() {
		yield* this.entries;
	}
}
export default FSH;

type FSHEntryOptions = {
	name?: string;
};

export class FSHEntry {
	name = '0000';
	id = 0x00;
	size = 0;
	width = 0;
	height = 0;
	center = [0, 0];
	offset = [0, 0];
	mipmaps: FSHImageData[] = [];
	constructor(opts: FSHEntryOptions) {
		this.name = opts.name ?? '0000';
	}

	// ## get image()
	// Image is just an alias for the first image data in the mipmaps array, 
	// which is normally always present.
	get image() {
		return this.mipmaps[0];
	}

	// ## get code()
	get code() {
		return this.id & 0x7f;
	}

	// ## *[Symbol.iterator]()
	*[Symbol.iterator]() {
		yield* this.mipmaps;
	}

	// ## parse(rs)
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
		let { code } = this;
		let sizeFactor = getSizeFactor(code);
		let image = new FSHImageData({
			code,
			width,
			height,
			data: rs.readUint8Array(width*height*sizeFactor),
		});

		// Read in all mipmaps too.
		let numMipMaps = oy >>> 24;
		this.mipmaps = [image];
		for (let i = 0; i < numMipMaps; i++) {
			let factor = 2**(i+1);
			let width = this.width/factor;
			let height = this.height/factor;
			let mipmap = new FSHImageData({
				code,
				width,
				height,
				data: rs.readUint8Array(width*height*sizeFactor),
			});
			this.mipmaps.push(mipmap);
		}
		return this;

	}
}

function getSizeFactor(code: number) {
	switch (code) {
		case 0x7b: return 1;
		case 0x7d: return 4;
		case 0x7f: return 3;
		case 0x60: return 0.5;
		case 0x61: return 1;
	}
	throw new Error(`Unknown FSH code 0x${code.toString(16)}`);
}

type FSHImageDataOptions = {
	code: number;
	width: number;
	height: number;
	data?: Uint8Array;
	bitmap?: Uint8Array;
};

// # FSHImageData
// The FSHImageData class contains the raw, encoded and potentially compressed 
// image data. This is the entry point for actually getting the raw bitmap.
// Note: if we're rendering a texture with Three.js, we don't need to decompress 
// it to a bitmap first because Three.js has support for decompressing textures 
// on the GPU. This can be done by creating a CompressedTexture in Three.js!
class FSHImageData {
	code = 0x00;
	width = 0;
	height = 0;
	data?: Uint8Array;
	bitmap?: Uint8Array;
	constructor(opts: FSHImageDataOptions) {
		this.code = opts.code;
		this.width = opts.width;
		this.height = opts.height;
		this.data = opts.data;
		this.bitmap = opts.bitmap;
	}
	decompress(): Uint8Array {
		let { width, height, data } = this;
		if (this.bitmap) return this.bitmap;
		switch (this.code) {
			case 0x07b:
				return this.bitmap = decompress8bit(data!, width, height);
			case 0x60:
				return this.bitmap = decompressDXT1(data!, width, height);
			case 0x61:
				return this.bitmap = decompressDXT3(data!, width, height);
		}
		throw new Error(`Code ${this.code.toString(16)}`);
		return new Uint8Array();
	}
}
