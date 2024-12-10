// # base-texture-file.js
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type { ConstructorOptions } from 'sc4/types';
import type Stream from './stream.js';

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
	xMinTract = 0x40;
	zMinTract = 0x40;
	xMaxTract = 0x40;
	zMaxTract = 0x40;
	xTractSize = 0x0002;
	zTractSize = 0x0002;
	u6 = 0x00000000;
	u7 = 0x00000000;
	u8 = 0x00000000;
	u9 = 0x00000000;
	minX = 0;
	minY = 0;
	minZ = 0;
	maxX = 0;
	maxY = 0
	maxZ = 0;
	u10 = 0x02;
	textures: Texture[] = [];
	constructor(opts?: ConstructorOptions<LotBaseTexture>) {
		Object.assign(this, opts);
	}

	// ## move(dx, dz)
	move(dx: [number, number] | number, dz: number) {
		if (Array.isArray(dx)) {
			[dx, dz] = dx;
		}
		dx = dx || 0;
		dz = dz || 0;
		this.minX += 16*dx;
		this.maxX += 16*dx;
		this.minZ += 16*dz;
		this.maxZ += 16*dz;

		// Recalculate the tracts. A tract is a 4x4 tile, so 4x16m in length.
		this.xMinTract = 0x40 + Math.floor(this.minX / 64);
		this.xMaxTract = 0x40 + Math.floor(this.maxX / 64);
		this.zMinTract = 0x40 + Math.floor(this.minZ / 64);
		this.zMaxTract = 0x40 + Math.floor(this.maxZ / 64);

		// Move the actual textures.
		for (let texture of this.textures) {
			texture.x += dx;
			texture.z += dz;
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
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();
		this.u6 = rs.dword();
		this.u7 = rs.dword();
		this.u8 = rs.dword();
		this.u9 = rs.dword();
		this.minX = rs.float();
		this.minY = rs.float();
		this.minZ = rs.float();
		this.maxX = rs.float();
		this.maxY = rs.float();
		this.maxZ = rs.float();
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
		ws.byte(this.xMinTract);
		ws.byte(this.zMinTract);
		ws.byte(this.xMaxTract);
		ws.byte(this.zMaxTract);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		ws.dword(this.u6);
		ws.dword(this.u7);
		ws.dword(this.u8);
		ws.dword(this.u9);
		ws.float(this.minX);
		ws.float(this.minY);
		ws.float(this.minZ);
		ws.float(this.maxX);
		ws.float(this.maxY);
		ws.float(this.maxZ);
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
	r = 0xff;
	g = 0xff;
	b = 0xff;
	alpha = 0xff;
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
		this.r = rs.byte();
		this.g = rs.byte();
		this.b = rs.byte();
		this.alpha = rs.byte();
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
		ws.byte(this.r);
		ws.byte(this.g);
		ws.byte(this.b);
		ws.byte(this.alpha);
		ws.byte(this.u6);
		ws.byte(this.u7);
		return ws.toUint8Array();
	}

}
