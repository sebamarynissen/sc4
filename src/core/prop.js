// # prop-file.js
import WriteBuffer from './write-buffer.js';
import SGProp from './sgprop.js';
import { FileType } from './enums.js';

// # Prop
// Represents a single prop from the prop file.
export default class Prop {

	static [Symbol.for('sc4.type')] = FileType.Prop;
	static [Symbol.for('sc4.type.array')] = true;

	// ## constructor(opts)
	constructor(opts) {
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0006;
		this.minor = 0x0004;
		this.zot = 0x0000;
		this.unknown1 = 0x00;
		this.appearance = 0b00000101;
		this.unknown2 = 0xA823821E;
		this.zMinTract = this.xMinTract = 0x00;
		this.zMaxTract = this.xMaxTract = 0x00;
		this.zTractSize = this.xTractSize = 0x0002;
		this.sgprops = [];
		this.GID = 0x00000000;
		this.TID = 0x00000000;
		this.IID1 = this.IID = 0x00000000;
		this.minZ = this.minY = this.minX = 0;
		this.maxZ = this.maxY = this.maxX = 0;
		this.orientation = 0x00;
		this.state = 0x00;
		this.stop = this.start = 0x00;
		this.timing = null;
		this.chance = 100;
		this.lotType = 0x02;
		this.OID = 0x00000000;
		this.condition = 0x00;
		Object.assign(this, opts);
	}

	// ## parse(rs)
	// Parses the prop from the given readable stream.
	parse(rs) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		this.unknown1 = rs.byte();
		this.appearance = rs.byte();
		this.unknown2 = rs.dword();
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();

		// Parse SGProps.
		let count = rs.dword();
		this.sgprops.length = count;
		for (let i = 0; i < count; i++) {
			let prop = this.sgprops[i] = new SGProp();
			prop.parse(rs);
		}

		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.IID1 = rs.dword();
		this.minX = rs.float();
		this.minY = rs.float();
		this.minZ = rs.float();
		this.maxX = rs.float();
		this.maxY = rs.float();
		this.maxZ = rs.float();
		this.orientation = rs.byte();
		this.state = rs.byte();
		this.start = rs.byte();
		this.stop = rs.byte();

		// Parse interal.
		count = rs.byte();
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
		ws.float(this.minX);
		ws.float(this.minY);
		ws.float(this.minZ);
		ws.float(this.maxX);
		ws.float(this.maxY);
		ws.float(this.maxZ);
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
