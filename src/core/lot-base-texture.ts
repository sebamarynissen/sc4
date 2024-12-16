// # base-texture-file.js
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type { ConstructorOptions } from 'sc4/types';
import type Stream from './stream.js';
import Box3 from './box-3.js';
import TractInfo from './tract-info.js';
import type { Vector3Like } from './vector-3.js';
import Color from './color.js';

// # LotBaseTexture
export default class LotBaseTexture {
	static [kFileType] = FileType.BaseTexture;
	static [kFileTypeArray] = true;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0002;
	minor = 0x0004;
	u1 = 0x00;
	u2 = 0x00;
	u3 = 0x00;
	u4 = 0x05;
	u5 = 0x497f6d9d;
	tract = new TractInfo();
	u6 = 0x00000000;
	u7 = 0x00000000;
	u8 = 0x00000000;
	u9 = 0x00000000;
	bbox = new Box3();
	u10 = 0x02;
	textures: Texture[] = [];
	constructor(opts?: ConstructorOptions<LotBaseTexture>) {
		Object.assign(this, opts);
	}

	// ## move(dx, dz)
	move(offset: Vector3Like) {
		this.bbox = this.bbox.translate(offset);
		this.tract.update(this);

		// Move the actual textures.
		for (let texture of this.textures) {
			texture.x += offset[0];
			texture.z += offset[2];
		}
		return this;
	}

	// ## parse(rs)
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.u1 = rs.byte();
		this.u2 = rs.byte();
		this.u3 = rs.byte();
		this.u4 = rs.byte();
		this.u5 = rs.dword();
		this.tract = rs.tract();
		this.u6 = rs.dword();
		this.u7 = rs.dword();
		this.u8 = rs.dword();
		this.u9 = rs.dword();
		this.bbox = rs.bbox();
		this.u10 = rs.byte();

		// Now read the tiles.
		let count = rs.dword();
		this.textures.length = count;
		for (let i = 0; i < count; i++) {
			let texture = this.textures[i] = new Texture();
			texture.parse(rs);
		}

		// Check that we've read everything.
		rs.assert();

	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.byte(this.u1);
		ws.byte(this.u2);
		ws.byte(this.u3);
		ws.byte(this.u4);
		ws.dword(this.u5);
		ws.tract(this.tract);
		ws.dword(this.u6);
		ws.dword(this.u7);
		ws.dword(this.u8);
		ws.dword(this.u9);
		ws.bbox(this.bbox);
		ws.byte(this.u10);
		ws.array(this.textures);
		return ws.seal();
	}

	// ## add(opts)
	// Adds a single texture into the array of all textures.
	add(opts: ConstructorOptions<Texture>) {
		let texture = new Texture(opts);
		this.textures.push(texture);
		return texture;
	}

}

// # Texture
class Texture {
	IID = 0x00000000;
	x = 0;
	z = 0;
	orientation = 0;
	priority = 0x00;
	color = new Color(0xff, 0xff, 0xff, 0xff);
	u6 = 0xff;
	u7 = 0x00;
	constructor(opts?: ConstructorOptions<Texture>) {
		Object.assign(this, opts);
	}

	// ## parse(rs)
	parse(rs: Stream) {
		this.IID = rs.dword();
		this.x = rs.byte();
		this.z = rs.byte();
		this.orientation = rs.byte();
		this.priority = rs.byte();
		this.color = rs.color();
		this.u6 = rs.byte();
		this.u7 = rs.byte();
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.IID);
		ws.byte(this.x);
		ws.byte(this.z);
		ws.byte(this.orientation);
		ws.byte(this.priority);
		ws.color(this.color);
		ws.byte(this.u6);
		ws.byte(this.u7);
		return ws.toUint8Array();
	}

}
