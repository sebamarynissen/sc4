// # building-file.js
import WriteBuffer from './write-buffer.js';
import FileType from './file-types.js';
import SGProp from './sgprop.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type Stream from './stream.js';
import type { ConstructorOptions } from 'sc4/types';

// # Building()
// Represents a single building from the building file.
export default class Building {
	static [kFileType] = FileType.Building;
	static [kFileTypeArray] = true;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0002;
	minor = 0x0004;
	zotWord = 0x0;
	unknown1 = 0x00;
	appearance = 0b00000101;
	xMinTract = 0x00;
	zMinTract = 0x00;
	xMaxTract = 0x00;
	zMaxTract = 0x00;
	xTractSize = 0x0002;
	zTractSize = 0x0002;
	sgprops: SGProp[] = [];
	unknown2 = 0x00;
	GID = 0x00000000;
	TID = 0x00000000;
	IID = 0x00000000;
	IID1 = 0x00000000;
	minX = 0;
	minY = 0;
	minZ = 0;
	maxX = 0;
	maxY = 0;
	maxZ = 0;
	orientation = 0x00;
	scaffold = 0x01;

	// ## constructor()
	constructor(opts: ConstructorOptions<Building>) {
		Object.assign(this, opts);
	}

	// ## move(dx, dy, dz)
	// The move vector of the building contains [dx, dy, dz] and should be 
	// given in meters! This is because apparently the min/max values of the 
	// building are given in meters as well.
	move(dx: number | [number, number, number], dy: number, dz: number) {
		if (Array.isArray(dx)) {
			[dx, dy, dz] = dx;
		}
		dx = dx ?? 0;
		dy = dy ?? 0;
		dz = dz ?? 0;
		this.minX += dx;
		this.maxX += dx;
		this.minY += dy;
		this.maxY += dy;
		this.minZ += dz;
		this.maxZ += dz;

		// Recalculate the tracts. A tract is a 4x4 tile, so 4x16m in length.
		this.xMinTract = 0x40 + Math.floor(this.minX / 64);
		this.xMaxTract = 0x40 + Math.floor(this.maxX / 64);
		this.zMinTract = 0x40 + Math.floor(this.minZ / 64);
		this.zMaxTract = 0x40 + Math.floor(this.maxZ / 64);
		return this;

	}

	// ## parse(rs)
	// Parses the building from a buffer wrapper up in a readable stream.
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zotWord = rs.word();
		this.unknown1 = rs.byte();
		this.appearance = rs.byte();

		// 0x278128A0, always the same.
		rs.dword();

		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();

		// Read the SGProps.
		this.sgprops = rs.sgprops();

		// There seems to be an error in the Wiki. The unknown byte should 
		// come **after** the IID1, otherwise they're incorrect.
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.IID1 = rs.dword();
		this.unknown2 = rs.byte();
		this.minX = rs.float();
		this.minY = rs.float();
		this.minZ = rs.float();
		this.maxX = rs.float();
		this.maxY = rs.float();
		this.maxZ = rs.float();
		this.orientation = rs.byte();
		this.scaffold = rs.float();

		// Make sure the entry was read correctly.
		rs.assert();
		return this;

	}

	// # toBuffer()
	// Creates a buffer for the building.
	toBuffer() {

		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zotWord);
		ws.byte(this.unknown1);
		ws.byte(this.appearance);
		ws.dword(0x278128A0);
		ws.byte(this.xMinTract);
		ws.byte(this.zMinTract);
		ws.byte(this.xMaxTract);
		ws.byte(this.zMaxTract);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		ws.array(this.sgprops);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.dword(this.IID1);
		ws.byte(this.unknown2);
		ws.float(this.minX);
		ws.float(this.minY);
		ws.float(this.minZ);
		ws.float(this.maxX);
		ws.float(this.maxY);
		ws.float(this.maxZ);
		ws.byte(this.orientation);
		ws.float(this.scaffold);

		// We're done. Seal the buffer and update our crc.
		let out = ws.seal();
		this.crc = +ws;
		return out;

	}

}
