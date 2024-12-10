// # lot-object.js
const scale = 0x00100000;
import type { ConstructorOptions, MinLengthArray, uint32 } from 'sc4/types';
import { inspect } from 'sc4/utils';
import type { ValueOf } from 'type-fest';

export type LotObjectArray = MinLengthArray<uint32, 12>;
export type LotObjectOptions = ConstructorOptions<LotObject> | LotObjectArray;

const LotObjectType = {
	Building: 0x00,
	Prop: 0x01,
	Texture: 0x02,
	Fence: 0x03,
	Flora: 0x04,
	Water: 0x05,
	Land: 0x06,
	Network: 0x07,
} as const;

// # LotObject
// A class for easier manipulation of LotConfigPropertyLotObject properties. 
// See www.wiki.sc4devotion.com/index.php?title=LotConfigPropertyLotObject, 
// these represent all objects on a lot.
export default class LotObject {
	static Building = LotObjectType.Building;
	static Prop = LotObjectType.Prop;
	static Texture = LotObjectType.Texture;
	static Fence = LotObjectType.Fence;
	static Flora = LotObjectType.Flora;
	static Water = LotObjectType.Water;
	static Land = LotObjectType.Land;
	static Network = LotObjectType.Network;
	type: ValueOf<typeof LotObjectType> = LotObject.Building;
	lod = 0x00;
	orientation = 0x00;
	x = 0.0;
	y = 0.0;
	z = 0.0;
	minX = 0.0;
	minZ = 0.0;
	maxX = 0.0;
	maxZ = 0.0;
	usage = 0x00;
	OID = 0x00000000;
	IIDs: number[] = [];
	networkType: number;
	RUL1: number;
	RUL2: number;

	// ## constructor(config)
	constructor(config: LotObjectOptions = {}) {
		if (Array.isArray(config)) {
			let [
				type,
				lod,
				orientation,
				x, y, z,
				minX, minZ, maxX, maxZ,
				usage,
				OID,
				...rest
			] = config;

			// IMPORTANT! If this is a network node, then we read the network 
			// connection type and RULs as well.
			let IID;
			if (type === LotObjectType.Network) {
				[this.networkType, this.RUL1, this.RUL2, IID] = rest;
			} else {
				[IID, ...rest] = rest;
			}
			Object.assign(this, {
				type,
				lod,
				orientation,
				x: x/scale,
				y: y/scale,
				z: z/scale,
				minX: 16*signed(minX)/scale,
				minZ: 16*signed(minZ)/scale,
				maxX: 16*signed(maxX)/scale,
				maxZ: 16*signed(maxZ)/scale,
				usage,
				OID,
				IIDs: [IID, ...rest],
			});
		} else {
			const { IID, ...rest } = config;
			Object.assign(this, {
				...(IID ? { IIDs: [IID] } : {}),
				...rest,
			});
		}
	}

	// ## IID()
	// Returns the 
	get IID() {
		return this.IIDs[0];
	}

	// ## toArray()
	// Converts the lotObject back to an array. This is needed for saving an 
	// exemplar again.
	toArray(): LotObjectArray {
		let {
			type, lod, orientation,
			x, y, z, minX, minZ, maxX, maxZ,
			usage, OID, IIDs,
		} = this;
		return [
			type,
			lod,
			orientation,
			Math.round(scale*x),
			Math.round(scale*y),
			Math.round(scale*z),
			uint(scale*minX/16),
			uint(scale*minZ/16),
			uint(scale*maxX/16),
			uint(scale*maxZ/16),
			usage,
			OID,
			...IIDs,
		];
	}

	// ## [inspect.symbol]()
	// Allows easily inspecting a LotObject.
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return {
			...this,
			type: inspect.hex(this.type, 2),
			lod: inspect.hex(this.lod, 2),
			usage: inspect.hex(this.usage),
			OID: inspect.hex(this.OID),
			IIDs: this.IIDs.map(value => inspect.hex(value)),
		};
	}

}

// ## signed(x)
// Helper function that ensures certain 32 bit integers are considered as 
// signed.
let arr = new Int32Array([0]);
function signed(x: number) {
	arr[0] = x;
	return arr[0];
}

// ## uint(x)
// Helper function that ensures a signed integer is convert back to an unsigned 
// integer.
let u = new Uint32Array([0]);
function uint(x: number) {
	u[0] = x;
	return u[0];
}
