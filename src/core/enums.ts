// # enums.js
// Contains sets of predefined values that are known to represent a certain 
// something. Kind of like enums, but JavaScript doesn't have them so we use 
// plain objects instead.
// # alias(source, map)
import type { Primitive } from 'type-fest';

type LiteralObject = { [key: string | symbol]: Primitive };

function makeEnum<T extends LiteralObject>(target: T) {
	return new Proxy(target, {
		get(target, key) {
			if (!(key in target)) {
				throw new Error(`Enum does not have property "${String(key)}"!`);
			}
			return target[key];
		},
	});
}

// Thanks to @CorinaMarie & @carlosmarcelo to figure this out.
export const ZoneType = {

	NoZone: 0x00,
	RLow: 0x01,
	RMedium: 0x02,
	RHigh: 0x03,
	CLow: 0x04,
	CMedium: 0x05,
	CHigh: 0x06,

	// This is actually agricultural
	ILow: 0x07,
	IMedium: 0x08,
	IHigh: 0x09,

	Military: 0x0A,
	Airport: 0x0B,
	Seaport: 0x0C,
	Spaceport: 0x0D,
	Landfill: 0x0E,
	Plopped: 0x0F,

};

export const DemandSourceIndex = {

	R$: 0x00001010,
	R$$: 0x00001020,
	R$$$: 0x00001030,

	CS$: 0x00003110,
	CS$$: 0x00003120,
	CS$$$: 0x00003130,
	CO$$: 0x00003320,
	CO$$$: 0x00003330,

	IR: 0x00004100,
	ID: 0x00004200,
	IM: 0x00004300,
	IHT: 0x00004400,

};

export { default as OccupantGroups } from './occupant-groups.js';
export { default as FileType } from './file-types.js';
export { default as cClass } from './cpp-classes.js';

export const SimGrid = {
	Power: 0x49d5bc86,
	ZoneData: 0x41800000,

	// Below are some common constants that can be found in the SimGrids.
	Constants: {
		Power: {
			Unpowered: 0x01,
			Powered: 0x02,
		},
		ZoneData: ZoneType,
	},

} as const;

export const LotObjectType = makeEnum({
	Building: 0x00,
	Prop: 0x01,
	Texture: 0x02,
	Fence: 0x03,
	Flora: 0x04,
	Water: 0x05,
	Land: 0x06,
	Network: 0x07,
} as const);

export const ExemplarProperty = makeEnum({
	ExemplarType: 0x10,
	ExemplarName: 0x20,
	Family: 0x27812870,
	BuildingFoundation: 0x88FCD877,
	UserVisibleNameKey: 0x8A416A99,
	ItemIcon: 0x8A2602B8,
	ItemOrder: 0x8A2602B9,
	QueryExemplarGUID: 0x2A499F85,
	SFXQuerySound: 0xAA1DD397,
	SFXDefaultPlopSound: 0xC9B93A56,
	SFXAmbientGoodSound: 0xCA19D7CA,
	SFXActivateSound: 0x4A4C132E,
	ResourceKeyType0: 0x27812820,
	ResourceKeyType1: 0x27812821,
	ResourceKeyType2: 0x27812822,
	ResourceKeyType3: 0x27812823,
	ResourceKeyType4: 0x27812824,
	ResourceKeyType5: 0x27812825,
	SimulatorDateStart: 0xca7515cc,
	SimulatorDateInterval: 0x0a751675,
	SimulatorDateDuration: 0x4a764564,
	LotConfigPropertyLotObject: 0x88edc900,
} as const);
