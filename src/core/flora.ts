// # flora-file.ts
import WriteBuffer from './write-buffer.js';
import SGProp from './sgprop.js';
import { FileType } from './enums.js';
import { getUnixFromJulian, getJulianFromUnix } from 'sc4/utils';
import { kFileType, kFileTypeArray } from './symbols.js';
import type Stream from './stream.js';

// # Flora
// Represents a single flora item. Note that you want to register 
// **Flora.Array** as file for the DBPF files, not the flora class itself!
export default class Flora {

	static [kFileType] = FileType.FloraFile;
	static [kFileTypeArray] = true;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0003;
	minor = 0x0004;
	zot = 0x0000;
	u1 = 0x00;
	appearance = 0b00001101;
	u2 = 0x74758926;
	xMinTract = 0x00;
	zMinTract = 0x00;
	xMaxTract = 0x00;
	zMaxTract = 0x00;
	xTractSize = 0x0002;
	zTractSize = 0x0002;
	sgprops: SGProp[] = [];
	GID = 0x00000000;
	TID = 0x00000000;
	IID = 0x00000000;
	IID1 = 0x00000000;
	x = 0;
	y = 0;
	z = 0;
	cycleDate = new Date();
	appearanceDate = new Date();
	state = 0x00;
	orientation = 0x00;
	objectId = 0x00000000;

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
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();

		// Read properties.
		const count = this.sgprops.length = rs.dword();
		for (let i = 0; i < count; i++) {
			let prop = this.sgprops[i] = new SGProp();
			prop.parse(rs);
		}

		// Read group ids.
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.IID1 = rs.dword();
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();
		this.cycleDate.setTime(getUnixFromJulian(rs.dword()));
		this.appearanceDate.setTime(getUnixFromJulian(rs.dword()));
		this.state = rs.byte();
		this.orientation = rs.byte();
		this.objectId = rs.dword();

		// Done
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
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		ws.dword(getJulianFromUnix(this.cycleDate));
		ws.dword(getJulianFromUnix(this.appearanceDate));
		ws.byte(this.state);
		ws.byte(this.orientation);
		ws.dword(this.objectId);
		return ws.seal();
	}

}
