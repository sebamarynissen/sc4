// # lot-file.js
"use strict";
const Stream = require('./stream');
const WriteStream = require('./write-stream');
const crc32 = require('./crc');
const SGProp = require('./sgprop');
const FileType = require('./file-types');
const { hex } = require('./util');
const { ZoneType, DemandSourceIndex } = require('./enums');

// Predefined bit-flags.
const HISTORICAL = 0x20;
const WATERED = 0x08;
const POWERED = 0x10;

// # LotFile
class LotFile {

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
		return Buffer.concat(Array.from(this.bgen()));
	}

	// ## *[Symbol.iterator]
	*[Symbol.iterator]() {
		yield* this.lots;
	}

};
module.exports = LotFile;

// # Lot
// Represents a single lot from the lot file
class Lot {

	// ## constructor()
	// Pre-initialize the lot properties with correct types to produce better 
	// optimized vm code. This is inherent to how V8 optimizes Object 
	// properties.
	constructor() {
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0008;
		this.IID = 0x00000000;
		this.flag1 = 0b01000000;
		this.maxZ = this.maxX = this.minZ = this.minX = 0x00;
		this.commuteZ = this.commuteX = 0x00;
		this.ySlope2 = this.ySlope1 = this.yPos = 0;
		this.depth = this.width = 0x00;
		this.orientation = 0x00;
		this.flag2 = 0x03;
		this.flag3 = 0x00;
		this.zoneType = 0x00;
		this.zoneWealth = 0x00;
		this.dateCreated = 0x00000000;
		this.buildingIID = 0x00000000;
		this.unknown5 = 0x00;
		this.linkedIndustrial = 0x00000000;
		this.linkedAgricultural = 0x00000000;
		this.jobCapacities = [];
		this.jobTotalCapacities = [];
		this.$ = 0;
		this.$$ = 0;
		this.$$$ = 0;
		this.unknown6 = 0x0002;
		this.sgprops = [];
		this.commutes = [];
		this.commuteBuffer = null;
		this.debug = 0x00;
	}

	// ## parse(rs)
	// Parses the load from a buffer wrapped up in a readable stream.
	parse(rs) {

		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.IID = rs.dword();
		this.flag1 = rs.byte();
		this.minX = rs.byte();
		this.minZ = rs.byte();
		this.maxX = rs.byte();
		this.maxZ = rs.byte();
		this.commuteX = rs.byte();
		this.commuteZ = rs.byte();
		this.yPos = rs.float();
		this.ySlope1 = rs.float();
		this.ySlope2 = rs.float();
		this.width = rs.byte();
		this.depth = rs.byte();
		this.orientation = rs.byte();
		this.flag2 = rs.byte();
		this.flag3 = rs.byte();
		this.zoneType = rs.byte();
		this.zoneWealth = rs.byte();
		this.dateCreated = rs.dword();
		this.buildingIID = rs.dword();
		this.unknown5 = rs.byte();
		this.linkedIndustrial = rs.dword()
		if (this.linkedIndustrial !== 0) {
			// 0x4A232DA8
			rs.skip(4);
		}
		this.linkedAgricultural = rs.dword();
		if (this.linkedAgricultural !== 0) {
			// 0xC9BD5D4A
			rs.skip(4);
		}

		// Read job capacities. Note that the count byte is either 0 or 1, so 
		// this means there will ever only be 1 sub array. No need to create 
		// this sub array then, just flatten it out directly.
		let count = rs.byte();
		this.jobCapacities.length = 0;
		for (let i = 0; i < count; i++) {
			let typeCount = rs.byte();
			for (let i = 0; i < typeCount; i++) {
				let demandSourceIndex = rs.uint32();
				let capacity = rs.uint16();
				this.jobCapacities.push({demandSourceIndex, capacity});
			}
		}

		// Read total job capacities.
		count = rs.byte();
		this.jobTotalCapacities.length = count;
		for (let i = 0; i < count; i++) {
			let demandSourceIndex = rs.uint32();
			let capacity = rs.uint16();
			this.jobTotalCapacities[i] = {demandSourceIndex, capacity};
		}

		this.$ = rs.uint32();
		this.$$ = rs.uint32();
		this.$$$ = rs.uint32();
		this.unknown6 = rs.word();

		// Read all props.
		count = rs.dword();
		let props = this.sgprops;
		props.length = count;
		for (let i = 0; i < count; i++) {
			let prop = props[i] = new SGProp();
			prop.parse(rs);
		}

		// Read the amount of commute blocs.
		count = rs.dword();
		this.commutes.length = count;

		// For now we're not parsing the commutes. Structure is still a bit 
		// unclear, we'll do this later. Simply store the raw buffer.
		if (count > 0) {
			let offset = rs.i - start;
			let byteLength = size - offset - 1;
			this.commuteBuffer = rs.read(byteLength);
		}

		// for (let i = 0; i < count; i++) {
			// if (!debug) break;
			// let block = this.commutes[i] = new CommuteBlock();
			// block.parse(rs, debug);
			// break;
		// }

		// Read the last byte, is unknown apparently.
		this.debug = rs.byte();

		// Make sure the entry was read correctly.
		let diff = rs.i - start;
		if (diff !== size) {
			try {
				throw new Error([
					'Error while reading the entry!',
					`Size is ${size}, but only ${diff} bytes were read!`
				].join(' '));
			} catch (e) {

				// Jump to the end.
				// rs.jump(start + size);
				throw e;

			}
		}

		// Done!
		return this;

	}

	// ## toBuffer(opts)
	toBuffer(opts) {
		return Buffer.concat(Array.from(this.bgen(opts)));
	}

	// ## *bgen(opts)
	*bgen(opts) {

		// Some shorthands.
		const p1 = this.linkedIndustrial, p2 = this.linkedAgricultural;

		// Initialize the first part of the buffer. This is part until we 
		// encounter the sgprops. Note that the length depends on whether 
		// there are linked industrial or agircultural lots.
		let size = 81;
		size += p1 > 0 ? 4 : 0;
		size += p2 > 0 ? 4 : 0;
		if (this.jobCapacities.length) {
			size += 1 + 6*this.jobCapacities.length;
		}
		if (this.jobTotalCapacities.length) {
			size += 6*this.jobTotalCapacities.length;
		}
		let one = Buffer.allocUnsafe(size);
		let ws = new WriteStream(one);

		// Size & crc are for later. Start at offset 8
		ws.jump(8);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.dword(this.IID);
		ws.byte(this.flag1);
		ws.byte(this.minX);
		ws.byte(this.minZ);
		ws.byte(this.maxX);
		ws.byte(this.maxZ);
		ws.byte(this.commuteX);
		ws.byte(this.commuteZ);
		ws.float(this.yPos);
		ws.float(this.ySlope1);
		ws.float(this.ySlope2);
		ws.byte(this.width);
		ws.byte(this.depth);
		ws.byte(this.orientation);
		ws.byte(this.flag2);
		ws.byte(this.flag3);
		ws.byte(this.zoneType);
		ws.byte(this.zoneWealth);
		ws.dword(this.dateCreated);
		ws.dword(this.buildingIID);
		ws.byte(this.unknown5);

		// Write await the pointers to linked lots.
		ws.dword(p1);
		if (p1 > 0) ws.dword(0x4A232DA8);
		ws.dword(p2);
		if (p2 > 0) ws.dword(0xC9BD5D4A);

		// Remember: jobCapacities is a flat array, but it isn't in the 
		// buffer, so take this into account.
		ws.byte(this.jobCapacities.length ? 1 : 0);
		if (this.jobCapacities.length) {
			ws.byte(this.jobCapacities.length);
			for (let entry of this.jobCapacities) {
				ws.dword(entry.demandSourceIndex);
				ws.word(entry.capacity);
			}
		}

		// Total job capacities is a flat array in the buffer. No special 
		// treatment here.
		ws.byte(this.jobTotalCapacities.length);
		for (let entry of this.jobTotalCapacities) {
			ws.dword(entry.demandSourceIndex);
			ws.word(entry.capacity);
		}

		// Go on.
		ws.uint32(this.$);
		ws.uint32(this.$$);
		ws.uint32(this.$$$);
		ws.word(this.unknown6);
		ws.dword(this.sgprops.length);

		// Check for errors.
		if (ws.i !== one.byteLength) {
			throw new Error('Error writing buffer!');
		}

		// Serialize all properties.
		let props = this.sgprops.map(prop => prop.toBuffer());

		// Create a new buffer for the amount of commute blocks.
		let blocs = Buffer.allocUnsafe(4);
		new WriteStream(blocs).dword(this.commutes.length);

		// Check if there's a commute buffer. Include it as is. We don't allow 
		// modifying the commutes for now.
		let commuteBuffer = this.commuteBuffer || Buffer.alloc(0);

		// A last buffer for the debug symbol.
		let debugSymbol = Buffer.from([this.debug]);

		// Concatenate, write away size & crc.
		let out = Buffer.concat([
			one, ...props, blocs, commuteBuffer, debugSymbol
		]);
		out.writeUInt32LE(out.byteLength, 0);
		out.writeUInt32LE(this.crc = crc32(out, 8), 4);

		yield out;

	}

}

// # CommuteBlock
// Represents a commmute block that is part of a lot.
class CommuteBlock {

	// ## constructor()
	constructor() {
		this.paths = [];
		this.unknown1 = 0x00;
		this.unknown2 = 0x00;
		this.unknown3 = 0x08;
		this.destinationX = 0x00;
		this.destinationY = 0x00;
		this.tripLength = 0;
		this.unknown4 = 0x00000002;
	}

	// ## parse(rs)
	parse(rs, debug) {

		let pathCount = rs.dword();
		this.paths.length = pathCount;
		for (let i = 0; i < pathCount; i++) {
			let path = this.paths[i] = new CommutePath();
			path.parse(rs);
		}
		// console.log(rs.buffer.slice(rs.i, rs.i+20).toString('hex'));
		// this.path = new CommutePath();
		// this.path.parse(rs);

		if (debug) {

		}

	}

}

// # CommutePath
class CommutePath {

	// ## constructor()
	constructor() {
		this.startType = 0x00;
		this.coords = [0x00,0x00];
	}

	parse(rs) {

		// Read the full path buffer.
		// let pos = rs.i;
		// let size = rs.dword();
		// rs.jump(pos);
		// rs = new Stream(rs.read(size));
		// rs.skip(4);

		// // Now repeat until we've read the entire path.
		// while (!rs.eof()) {
		// 	let swap = rs.byte();
		// 	let length = rs.byte();
		// 	console.log(length);
		// }

		// console.log(rs.toString('hex'));
		// let size = rs.dword();
		// this.startType = rs.byte();
		// this.coords = [rs.byte(), rs.byte()];

		// console.log(this.coords);

	}

}

// # OldLot()
// Represents a single lot from the lot file.
class OldLot {

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
			"enumerable": false,
			"configurable": true,
			"writable": true
		});

		// We want to have easy access to the properties after the anchor or 
		// farm lot memory address. The offset of this part varies though due 
		// to the fact that several values only appear if other values are not 
		// 0. Detect this.
		let shift = 0;
		let linkedIndustrial = this.buffer.readUInt32LE(53);
		if (linkedIndustrial !== 0) shift += 4;
		let linkedFarm = this.buffer.readUInt32LE(57 + shift);
		if (linkedFarm !== 0) shift += 4;

		const bin = read.buffer;
		const part2 = Buffer.from(bin, read.offset + 61 + shift);
		Object.defineProperty(this, 'buffer2', {
			"value": part2,
			"enumerable": false,
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
		return Buffer.concat(Array.from(this.bgen()));
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

	get lotIID() { return this.buffer.readUInt32LE(14); }
	get buildingIID() { return this.buffer.readUInt32LE(48); }

	// Getter for the flag byte that contains whether a building is historical 
	// or not.
	get flag1() { return this.buffer.readUInt8(18); }
	set flag1(value) { this.buffer.writeUInt8(value, 18); }

	get minX() { return this.buffer.readUInt8(19); }
	set minX(value) { this.buffer.writeUInt8(value, 19); }
	get minZ() { return this.buffer.readUInt8(20); }
	set minZ(value) { this.buffer.writeUInt8(value, 20); }
	get maxX() { return this.buffer.readUInt8(21); }
	set maxX(value) { this.buffer.writeUInt8(value, 21); }
	get maxZ() { return this.buffer.readUInt8(22); }
	set maxZ(value) { this.buffer.writeUInt8(value, 22); }

	// The holy grail: get & set whether the lot is historical.
	get historical() { return Boolean(this.flag1 & HISTORICAL); }
	set historical(on) { this.flag1 = set(HISTORICAL, this.flag1, on); }

	get zoneType() { return this.buffer.readUInt8(42); }
	set zoneType(value) { this.buffer.writeUInt8(value, 42); }

	// Parses the jobCapapcities entry from the underlying buffer. It's here 
	// that we'll be able to determine whether the lot is residential, 
	// commercial or residential if it's plopped.
	get jobCapacities() {
		const rs = new Stream(this.buffer2);

		// N is apparently always either 0 or 1, so we don't need to raise the 
		// output array dimension. We can keep it as flat as possible.
		const n = rs.byte();
		let out = [];
		for (let i = 0; i < n; i++) {
			const typeCount = rs.byte();
			for (let i = 0; i < typeCount; i++) {
				let demandSourceIndex = rs.uint32();
				let capacity = rs.uint16();
				out.push({demandSourceIndex, capacity});
			}
		}

		return out;
	}

	// ## get isPlopped()
	// Getter for checking whether a lot is a plopped lot.
	get isPlopped() {
		return this.zoneType === ZoneType.Plopped;
	}

	// ## isResidential()
	// Getter for checking whether this lot is a residential lot. A lot is 
	// considered residential if it has a residential demand source index.
	get isResidential() {
		let jobs = this.jobCapacities;
		for (let job of jobs) {
			switch (job.demandSourceIndex) {
				case DemandSourceIndex.R$:
				case DemandSourceIndex.R$$:
				case DemandSourceIndex.R$$$:
					return true;
			}
		}
		return false;
	}

	// ## get isPloppedResidential()
	// Getter for checking whether this lot is a plopped residential. We do 
	// this by checking first of all whether the lot is plopped or not. This 
	// is stored in zoneType, and plopped lots have zoneType 0x0f. Then we 
	// still have to figure out if this lot is a residential lot, it could be 
	// a park etc. as well. Therefore we'll ask the jobCapacities. If it has 
	// R somewhere here, it's a residential plopped building. Great!
	get isPloppedResidential() {
		return this.isPlopped && this.isResidential;
	}

	// ## get isCommercial()
	get isCommercial() {
		let jobs = this.jobCapacities;
		for (let job of jobs) {
			switch (job.demandSourceIndex) {
				case DemandSourceIndex.CS$:
				case DemandSourceIndex.C$$:
				case DemandSourceIndex.C$$$:
				case DemandSourceIndex.CO$$:
				case DemandSourceIndex.CO$$$:
					return true;
			}
		}
		return false;
	}

	// ## get isAgricultural()
	get isAgricultural() {
		let jobs = this.jobCapacities;
		for (let job of jobs) {
			if (job.demandSourceIndex === DemandSourceIndex.IR) return true;
		}
		return false;
	}

	// ## get isPloppedAgricultural()
	get isPloppedAgricultural() {
		return this.isPlopped && this.isAgricultural;
	}

	// ## get isIndustrial()
	// Getter for checking whether this lot is industrial, which is the case 
	// if there are industrial jobs.
	// Note: agricultural is **NOT** treated as industrial! Use is 
	// AgriCultural for this!
	get isIndustrial() {
		let jobs = this.jobCapacities;
		for (let job of jobs) {
			switch (job.demandSourceIndex) {
				case DemandSourceIndex.ID:
				case DemandSourceIndex.IM:
				case DemandSourceIndex.IHT:
					return true;
			}
		}
		return false;
	}

	// ## get isPloppedIndustrial()
	// Same principle as isPloppedResidential
	get isPloppedIndustrial() {
		return this.isPlopped && this.isIndustrial;
	}

}

// Helper function for switching bit flags on & off.
function set(bit, flag, on) {
	return on ? bit | flag : bit & 0xff - flag;
}