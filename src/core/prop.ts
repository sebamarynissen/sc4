// # prop-file.js
import WriteBuffer from './write-buffer.js';
import SGProp from './sgprop.js';
import { FileType } from './enums.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type { ConstructorOptions } from 'sc4/types';
import type Stream from './stream.js';
import Box3 from './box-3.js';
import TractInfo from './tract-info.js';

type Timing = {
	interval: number;
	duration: number;
	start: number;
	end: number;
};

// # Prop
// Represents a single prop from the prop file.
export default class Prop {
	static [kFileType] = FileType.Prop;
	static [kFileTypeArray] = true;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0006;
	minor = 0x0004;
	zot = 0x0000;
	unknown1 = 0x00;
	appearance = 0b00000101;
	unknown2 = 0xA823821E;
	tract = new TractInfo();
	sgprops: SGProp[] = [];
	GID = 0x00000000;
	TID = 0x00000000;
	IID = 0x00000000;
	IID1 = 0x00000000;
	bbox = new Box3();
	orientation = 0x00;
	state = 0x00;
	start = 0x00
	stop = 0x00;
	timing: Timing | null = null;
	chance = 100;
	lotType = 0x02;
	OID = 0x00000000;
	condition = 0x00;

	// ## constructor(opts)
	constructor(opts?: ConstructorOptions<Prop>) {
		Object.assign(this, opts);
	}

	// ## parse(rs)
	// Parses the prop from the given readable stream.
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		this.unknown1 = rs.byte();
		this.appearance = rs.byte();
		this.unknown2 = rs.dword();
		this.tract = rs.tract();
		this.sgprops = rs.sgprops();
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.IID1 = rs.dword();
		this.bbox = rs.bbox();
		this.orientation = rs.byte();
		this.state = rs.byte();
		this.start = rs.byte();
		this.stop = rs.byte();

		// Parse interal.
		let count = rs.byte();
		if (count) {
			this.timing = {
				interval: rs.dword(),
				duration: rs.dword(),
				start: rs.dword(),
				end: rs.dword(),
			};
		}

		this.chance = rs.byte();
		this.lotType = rs.byte();
		this.OID = rs.dword();
		this.condition = rs.byte();
		rs.assert();

		// Done.
		return this;

	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		ws.byte(this.unknown1);
		ws.byte(this.appearance);
		ws.dword(this.unknown2);
		ws.tract(this.tract);
		ws.array(this.sgprops);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.dword(this.IID1);
		ws.bbox(this.bbox);
		ws.byte(this.orientation);
		ws.byte(this.state);
		ws.byte(this.start);
		ws.byte(this.stop);
		ws.byte(this.timing ? 1 : 0);
		if (this.timing) {
			let timing = this.timing;
			ws.dword(timing.interval);
			ws.dword(timing.duration);
			ws.dword(timing.start);
			ws.dword(timing.end);
		}
		ws.byte(this.chance);
		ws.byte(this.lotType);
		ws.dword(this.OID);
		ws.byte(this.condition);
		return ws.seal();
	}

}
