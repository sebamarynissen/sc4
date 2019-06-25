// # prop-file.js
"use strict";
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const crc32 = require('./crc');
const SGProp = require('./sgprop');
const FileType = require('./file-types');

// # PropFile
class PropFile {

	static get id() {
		return FileType.PropFile;
	}

	// ## constructor()
	constructor() {
		this.clear();
	}

	// ## clear()
	clear() {
		this.props = [];
		return this;
	}

	// ## parse(buff, opts)
	parse(buff, opts) {
		let props = this.props;
		props.length = 0;

		// Read all props one by one.
		let rs = new Stream(buff);
		while (!rs.eof()) {
			let prop = new Prop();
			prop.parse(rs);
			props.push(prop);
		}

		return this;

	}

	// ## *bgen(opts)
	*bgen(opts) {
		for (let prop of this.props) {
			yield* prop.bgen(opts);
		}
	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen()));
	}

	// ## *[Symbol.iterator]()
	*[Symbol.iterator]() {
		yield* this.props;
	}

}
module.exports = PropFile;

// # Prop
// Represents a single prop from the prop file.
class Prop {

	// ## constructor()
	constructor() {
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0006;
		this.minor = 0x0004;
		this.zot = 0x0000;
		this.unknown1 = 0x00;
		this.appearance = 0x00;
		this.unknown2 = 0xA823821E;
		this.minTractZ = this.minTractX = 0x00;
		this.maxTractZ = this.maxTractX = 0x00;
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
	}

	// ## parse(rs)
	// Parses the prop from the given readable stream.
	parse(rs) {
		
		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		this.unknown1 = rs.byte();
		this.appearance = rs.byte();
		this.unknown2 = rs.dword();
		this.minTractX = rs.byte();
		this.minTractZ = rs.byte();
		this.maxTractX = rs.byte();
		this.maxTractZ = rs.byte();
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
				"interval": rs.dword(),
				"duration": rs.dword(),
				"start": rs.dword(),
				"end": rs.dword()
			};
		}

		this.chance = rs.byte();
		this.lotType = rs.byte();
		this.OID = rs.dword();
		this.condition = rs.byte();

		let diff = rs.i - start;
		if (diff !== size) {
			console.warn([
				'Error while reading a prop!', 
				`Size is ${size}, but read ${diff} bytes!`,
				'This may indicate a prop-poxed city!'
			].join(' '));
			rs.jump(start + size);
		}

		// Done.
		return this;

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

	// ## *bgen(opts)
	*bgen(opts) {
		
		// Prepare the first part of the buffer, going to the sgprops.
		let one = Buffer.allocUnsafe(36);
		let ws = new WriteStream(one);
		ws.jump(8);

		// Start writing. CRC & size will come later.
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		ws.byte(this.unknown1);
		ws.byte(this.appearance);
		ws.dword(this.unknown2);
		ws.byte(this.minTractX);
		ws.byte(this.minTractZ);
		ws.byte(this.maxTractX);
		ws.byte(this.maxTractZ);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		ws.dword(this.sgprops.length);

		// Now the sgprops.
		let props = this.sgprops.map(prop => prop.toBuffer());
		let bytes = 52 + (this.timing ? 16 : 0);
		let two = Buffer.allocUnsafe(bytes);
		ws = new WriteStream(two);

		// Continue writing.
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

		// Concatenate & handle crc.
		let out = Buffer.concat([one, ...props, two]);
		out.writeUInt32LE(out.byteLength, 0);
		out.writeUInt32LE(this.crc = crc32(out, 8), 4);

		// Done, yield the buffer.
		yield out;

	}

}