import type { ConditionalKeys, RequireAtLeastOne } from 'type-fest';

export type byte = number;
export type uint8 = number;
export type uint16 = number;
export type uint32 = number;
export type uint64 = bigint;
export type sint8 = number;
export type sint16 = number;
export type sint32 = number;
export type sint64 = bigint;
export type float = number;
export type double = number;
export type word = uint16;
export type dword = uint32;
export type qword = uint64;
export type TGILiteral<
	T extends uint32 = uint32,
	G extends uint32 = uint32,
	I extends uint32 = uint32
> = { type: T; group: G; instance: I; }
export type TGIQuery<
	T extends uint32 = uint32,
	G extends uint32 = uint32,
	I extends uint32 = uint32
> = RequireAtLeastOne<TGILiteral<T, G, I>>;
export type TGIArray<
	T extends uint32 = uint32,
	G extends uint32 = uint32,
	I extends uint32 = uint32
> = [type: T, group: G, instance: I];
export type TGILike<
	T extends uint32 = uint32,
	G extends uint32 = uint32,
	I extends uint32 = uint32
> = TGILiteral<T, G, I> | TGIArray<T, G, I>;

// It's not always clear what units are being used, as you can have meters (1 
// tile = 16 meters), tiles, or tracts - where 1 tract is dependent on the 
// stored tract size, which is always 0x02 though. To make this more explicit, 
// we'll alias the "number" type properly.
export type meters = float;
export type tiles = byte;
export type tracts = byte;

// A type that we often use to allow all non-function keys of a class to be 
// specified as options.
export type ConstructorOptions<T> = Omit<
	Partial<T>,
	ConditionalKeys<T, (...args: any[]) => any>
>;

export type MinLengthArray<T, N extends number, R extends T[] = []> = R['length'] extends N ? [...R, ...T[]] : MinLengthArray<T, N, [T, ...R]>;

// General logger type.
export type Logger = {
	ok: (...args: any[]) => any,
	error: (...args: any[]) => any,
	warn: (...args: any[]) => any,
	info: (...args: any[]) => any,
	log: (...args: any[]) => any,
	step: (text: string) => any,
	progress: (text?: string) => any,
	succeed: (text?: string) => any,
	fail: (text?: string) => any,
};
