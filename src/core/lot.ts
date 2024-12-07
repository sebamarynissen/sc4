// # lot-file.js
import WriteBuffer from './write-buffer.js';
import { FileType, ZoneType, DemandSourceIndex } from './enums.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type SGProp from './sgprop.js';
import type { OptionalKeysOf } from 'type-fest';
import type Stream from './stream.js';
import type { byte } from 'sc4/types';

// Predefined bit-flags.
const Flags = {
	Historical: 0x20,
	Watered: 0x08,
	Powered: 0x10,
};

// # Lot
// Represents a single lot from the lot file
export default class Lot {

	static [kFileType] = FileType.LotFile;
	static [kFileTypeArray] = true;

	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0008;
	IID = 0x00000000;
	flag1 = 0b01000000;
	minX = 0x00;
	minZ = 0x00;
	maxX = 0x00;
	maxZ = 0x00;
	commuteX = 0x00;
	commuteZ = 0x00;
	yPos = 0;
	ySlope1 = 0
	ySlope2 = 0
	width = 0x00;
	depth = 0x00;
	orientation = 0x00;
	flag2 = 0x03;
	flag3 = 0x00;
	zoneType = 0x00;
	zoneWealth = 0x00;
	dateCreated = 0x00000000;
	buildingIID = 0x00000000;
	unknown5 = 0x00;
	linkedIndustrial = 0x00000000;
	linkedAgricultural = 0x00000000;
	jobCapacities: any[] = [];
	jobTotalCapacities: any[] = [];
	$ = 0;
	$$ = 0;
	$$$ = 0;
	unknown6 = 0x0002;
	sgprops: SGProp[] = [];
	commutes: any[] = [];
	commuteBuffer: Uint8Array = null;
	debug = 0x00;

	// ## constructor()
	// Pre-initialize the lot properties with correct types to produce better 
	// optimized vm code. This is inherent to how V8 optimizes Object 
	// properties.
	constructor(opts: OptionalKeysOf<Lot>) {
		Object.assign(this, opts);
	}

	// ## get/set historical()
	get historical() {
		return Boolean(this.flag1 & Flags.Historical);
	}
	set historical(on) {
		this.flag1 = set(Flags.Historical, this.flag1, on);
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
				case DemandSourceIndex.CS$$:
				case DemandSourceIndex.CS$$$:
				case DemandSourceIndex.CO$$:
				case DemandSourceIndex.CO$$$:
					return true;
			}
		}
		return false;
	}

	// ## get isPloppedCommercial()
	// Just like `isPloppedResidential`, this checks if the lot is to be 
	// considered a plopped commercial. This is the case if the ZoneTYpe is 
	// set to plopped *and* it has commercial capacity. Note that this means 
	// that *functional* landmarks might get growified this way as well!
	get isPloppedCommercial() {
		return this.isPlopped && this.isCommercial;
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
	move(dx: number, dz: number): this;
	move([dx, dz]: [number, number]): this;
	move(dx: number | [number, number], dz?: number): this {
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
	parse(rs: Stream) {
		rs.size();
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
		this.linkedIndustrial = rs.dword();
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
				this.jobCapacities.push({ demandSourceIndex, capacity });
			}
		}

		// Read total job capacities.
		count = rs.byte();
		this.jobTotalCapacities.length = count;
		for (let i = 0; i < count; i++) {
			let demandSourceIndex = rs.uint32();
			let capacity = rs.uint16();
			this.jobTotalCapacities[i] = { demandSourceIndex, capacity };
		}

		this.$ = rs.float();
		this.$$ = rs.float();
		this.$$$ = rs.float();
		this.unknown6 = rs.word();
		this.sgprops = rs.sgprops();

		// Read the amount of commute blocs.
		count = rs.dword();
		this.commutes.length = count;

		// For now we're not parsing the commutes. Structure is still a bit 
		// unclear, we'll do this later. Simply store the raw buffer.
		if (count > 0) {
			this.commuteBuffer = rs.read(rs.remaining()-1);
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
		rs.assert();

		// Done!
		return this;

	}

	// # toBuffer()
	toBuffer() {

		// Some shorthands.
		const p1 = this.linkedIndustrial;
		const p2 = this.linkedAgricultural;

		// Start filling the buffer now in a smart way.
		let ws = new WriteBuffer();
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
		ws.array(this.sgprops);

		// Create a new buffer for the amount of commute blocks.
		ws.dword(this.commutes.length);

		// Check if there's a commute buffer. Include it as is. We don't allow 
		// modifying the commutes for now.
		let commuteBuffer = this.commuteBuffer || new Uint8Array(0);
		ws.write(commuteBuffer);

		// A last buffer for the debug symbol.
		ws.byte(this.debug);

		// Seal the buffer and return.
		return ws.seal();

	}

}

// # CommuteBlock
// Represents a commmute block that is part of a lot.
// eslint-disable-next-line no-unused-vars
class CommuteBlock {

	paths: any[] = [];
	unknown1 = 0x00;
	unknown2 = 0x00;
	unknown3 = 0x08;
	destinationX = 0x00;
	destinationY = 0x00;
	tripLength = 0;
	unknown4 = 0x00000002;

	// ## parse(rs)
	parse(rs: Stream) {

		let pathCount = rs.dword();
		this.paths.length = pathCount;
		for (let i = 0; i < pathCount; i++) {
			let path = this.paths[i] = new CommutePath();
			path.parse(rs);
		}
		// console.log(rs.buffer.slice(rs.i, rs.i+20).toString('hex'));
		// this.path = new CommutePath();
		// this.path.parse(rs);

	}

}

// # CommutePath
class CommutePath {
	startType = 0x00;
	coords = [0x00, 0x00];

	parse(rs: Stream) {

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
function set(bit: byte, flag: byte, on: boolean) {
	return on ? bit | flag : bit & 0xff - flag;
}
