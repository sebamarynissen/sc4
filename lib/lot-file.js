// # lot-file.js
"use strict";
const Stream = require('./stream');
const crc32 = require('./crc');
const Props = require('./exemplar-props');
const FileType = require('./file-types');
const { hex } = require('./util');

// Predefined bit-flags.
const HISTORICAL = 0x20;
const WATERED = 0x08;
const POWERED = 0x10;

module.exports = class LotFile {

	static get id() {
		return FileType.LotFile;
	}

	// ## constructor()
	constructor() {
		this.lots = [];
	}

	// ## parse(buff, opts)
	parse(buff, opts) {

		let lots = this.lots;
		lots.length = 0;

		// Read all lots baby.
		let rs = new Stream(buff);
		let i = 0;
		while (!rs.eof()) {
			let lot = new Lot();
			lot.parse(rs);
			lots.push(lot);
		}

		return this;

	}

	// ## *bgen(opts)
	*bgen(opts) {
		for (let lot of this.lots) {
			yield* lot.bgen(opts);
		}
	}

	// # toBuffer(opts)
	toBuffer(opts) {
		return Array.from(this.bgen());
	}

	// ## *[Symbol.iterator]
	*[Symbol.iterator]() {
		yield* this.lots;
	}

};

// # Lot()
// Represents a single lot from the lot file.
class Lot {

	// ## constructor()
	constructor() {}

	// ## parse(rs)
	// Parses the lot from a buffer wrapped up in a readable stream. Note that 
	// we don't need to completely decode the file in order to do what we 
	// want. We just want to make every lot historical. In order to do this, 
	// we simply need to turn on a single bit-flag and re-calculate the crc 
	// and overwrite this in the underlying buffer.
	parse(rs) {
		let size = rs.buffer.readUInt32LE(rs.i);
		let read = rs.read(size);
		Object.defineProperty(this, 'buffer', {
			"value": read,
			"false": true,
			"configurable": true,
			"writable": true
		});

		return this;

	}

	// ## toBuffer()
	// Serializes the lot file back into a buffer. Note that as we're not 
	// completely decoding the lot file, we can simply re-use the underlying 
	// buffer!
	toBuffer() {
		return Array.from(this.bgen());
	}

	// ## *bgen()
	*bgen() {

		// Re-calculate our CRC checksum & set it. Then yield the buffer as is.
		this.crc = this.calculateCRC();
		yield this.buffer;

	}

	// ## calculateCRC()
	// Calculates the CRC checksum of this lot entry.
	calculateCRC() {

		// Important! When taking the slice, we need to take into account that 
		// the buffer is merely a view on top of the underlying array buffer. 
		// Hence we need to deal with the offsets correctly!
		const view = this.buffer;
		const bin = view.buffer;
		let slice = Buffer.from(bin, view.offset+8, this.size-8);
		return crc32(slice);

	}

	get size() { return this.buffer.readUInt32LE(0); }

	// Define some getters & setters that access raw buffer properties.
	get crc() { return this.buffer.readUInt32LE(4); }
	set crc(value) { this.buffer.writeUInt32LE(value, 4); }

	// Getter for the flag byte that contains whether a building is historical 
	// or not.
	get flag1() { return this.buffer.readUInt8(18); }
	set flag1(value) { this.buffer.writeUInt8(value, 18); }

	// The holy grail: get & set whether the lot is historical.
	get historical() { return this.buffer.flag1 & HISTORICAL; }
	set historical(on) { this.flag1 = set(HISTORICAL, this.flag1, on); }

	// ## parseComplete(rs)
	// Complete decodes the lot file from the buffer. We'll have to do this 
	// eventually for more complex stuff, but not required for making 
	// buildings historical.
	parseComplete(rs) {

		let size = rs.uint32();
		let crc = rs.uint32();
		let memory = rs.uint32();
		let major = rs.uint16();
		let iid = rs.uint32();

		let flag1 = this.flag1 = rs.uint8();
		
		let minX = rs.uint8();
		let minZ = rs.uint8();
		let maxX = rs.uint8();
		let maxZ = rs.uint8();
		let commuteX = rs.uint8();
		let commuteZ = rs.uint8();

		let posY = rs.float();

		// Y coordinate is repeated for some reason.
		let yCoord = rs.float();
		let unknown = rs.float();

		let width = rs.uint8();
		let depth = rs.uint8();
		let orientation = rs.uint8();

		let flag2 = this.flag2 = rs.uint8();
		let flag3 = this.flag3 = rs.uint8();

		let zoneType = rs.uint8();
		let zoneWealth = rs.uint8();
		let appeared = rs.uint32();
		let buildingIid = rs.uint32();

		// Unknown
		rs.uint8();

		// Don't know what these things do.
		rs.uint32();
		rs.uint32();
		rs.uint32();
		rs.uint32();

		let count = rs.byte();
		let rciCount = rs.byte();
		let demandSourceIndex = rs.dword();
		let capacity = rs.word();

		let rciTypeCount = rs.byte();
		let demandSourceIndex2 = rs.dword();
		let totalCapacity = rs.word();

		// I think there's an error on the SC4D wiki. It states that the §, §§ 
		// and §§§ capacities are floats, but this seems to be incorrect. 
		// Given that after these values should come 0x0002 (although it's 
		// unkown). This is the case if these are uint16's.
		let $ = rs.uint16();
		let $$ = rs.uint16();
		let $$$ = rs.uint16();

		// Unknown value, which seems to be always be 0x0002.
		unknown = rs.word();

		// Now read the amount of SGProps that follow.
		let propCount = rs.dword();
		let props = new Array(propCount);;
		for (let i = 0; i < propCount; i++) {

			// Name is doubled for some unknown reason. Then follows 
			// 0x00000000, skip both.
			let name = rs.dword();
			rs.dword();
			rs.dword();

			// Data type & key type.
			let type = rs.byte();
			let keyType = rs.byte();

			// 0x0000
			rs.word();

			const reps = keyType === 0x80 ? rs.uint32() : 1;
			let arr = [];
			for (let i = 0; i < reps; i++) {
				let value;
				switch (type) {
					case 0x01:
						value = rs.uint8();
						break;
					case 0x02:
						value = rs.uint16();
						break;
					case 0x03:
						value = rs.uint32();
						break;
					case 0x07:
						value = rs.int32();
						break;
					case 0x08:
						value = rs.bigint();
						break;
					case 0x0B:
						value = rs.bool();
						break;
				}
				arr.push(value);
			}	

			props[i] = {
				"name": name,
				"type": type,
				"keyType": keyType,
				"value": arr
			};

		}

		// Commute block & path count.
		let commuteBlockCount = rs.dword();

		// Following only needs to be done if there are blocks.
		if (commuteBlockCount > 0) {

			// TODO.

		}

		// Read in the last byte. Can be anything apparently.
		rs.byte();

		return this;

	}

}

// Helper function for switching bit flags on & off.
function set(bit, flag, on) {
	return on ? bit | flag : bit & 0xff - flag;
}