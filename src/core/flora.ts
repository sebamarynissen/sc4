// # flora-file.ts
import WriteBuffer from './write-buffer.js';
import SGProp from './sgprop.js';
import { FileType } from './enums.js';
import { getUnixFromJulian, getJulianFromUnix } from 'sc4/utils';
import { kFileType, kFileTypeArray } from './symbols.js';
import type Stream from './stream.js';
import type { ConstructorOptions } from 'sc4/types';
import TractInfo from './tract-info.js';
import Vector3 from './vector-3.js';

// # Flora
// Represents a single flora item. Note that you want to register 
// **Flora.Array** as file for the DBPF files, not the flora class itself!
export default class Flora {
	static [kFileType] = FileType.Flora;
	static [kFileTypeArray] = true;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0003;
	minor = 0x0004;
	zot = 0x0000;
	u1 = 0x00;
	appearance = 0b00001101;
	u2 = 0x74758926;
	tract = new TractInfo();
	sgprops: SGProp[] = [];
	GID = 0x00000000;
	TID = 0x00000000;
	IID = 0x00000000;
	IID1 = 0x00000000;
	position = new Vector3();
	cycleDate = new Date();
	appearanceDate = new Date();
	state = 0x00;
	orientation = 0x00;
	objectId = 0x00000000;

	constructor(opts?: ConstructorOptions<Flora>) {
		Object.assign(this, opts);
	}

	// ## parse(rs)
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		this.u1 = rs.byte();
		this.appearance = rs.byte();
		this.u2 = rs.dword();
		this.tract = rs.tract();
		this.sgprops = rs.sgprops();
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.IID1 = rs.dword();
		this.position = rs.vector3();
		this.cycleDate.setTime(getUnixFromJulian(rs.dword()));
		this.appearanceDate.setTime(getUnixFromJulian(rs.dword()));
		this.state = rs.byte();
		this.orientation = rs.byte();
		this.objectId = rs.dword();
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		ws.byte(this.u1);
		ws.byte(this.appearance);
		ws.dword(this.u2);
		ws.tract(this.tract);
		ws.array(this.sgprops);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.dword(this.IID1);
		ws.vector3(this.position);
		ws.dword(getJulianFromUnix(this.cycleDate));
		ws.dword(getJulianFromUnix(this.appearanceDate));
		ws.byte(this.state);
		ws.byte(this.orientation);
		ws.dword(this.objectId);
		return ws.seal();
	}

}
