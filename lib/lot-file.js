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

	static get id() { return FileType.LotFile; }
	get type() { return FileType.LotFile; }

	// ## constructor()
	constructor() {
		this.clear();
	}

	// ## get length()
	get length() {
		return this.lots.length;
	}

	// ## clear()
	// Clears all lots from the file.
	clear() {
		this.lots = [];
		return this;
	}

	// ## add()
	// Adds a new lot to the lot file and returns it. The lot will be rather 
	// empty, it's up to the caller to populate it.
	add() {
		let lot = new Lot();
		this.lots.push(lot);
		return lot;
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
const Lot = LotFile.Lot = class Lot {

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

	// ## get/set historical()
	get historical() {
		return Boolean(this.flag1 & HISTORICAL);
	}
	set historical(on) {
		this.flag1 = set(HISTORICAL, this.flag1, on);
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

	// ## move(dx, dz)
	// Moves the lot according to the given vector. Note that this doesn't 
	// affect any buildings or props on the lot!
	move(dx, dz) {
		if (Array.isArray(dx)) {
			[dx, dz] = dx;
		}
		dx = dx || 0;
		dz = dz || 0;
		this.minX += dx;
		this.maxX += dx;
		this.commuteX += dx;
		this.minZ += dz;
		this.maxZ += dz;
		this.commuteZ += dz;
		return this;

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

		this.$ = rs.float();
		this.$$ = rs.float();
		this.$$$ = rs.float();
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
		ws.float(this.$);
		ws.float(this.$$);
		ws.float(this.$$$);
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

// Helper function for switching bit flags on & off.
function set(bit, flag, on) {
	return on ? bit | flag : bit & 0xff - flag;
}