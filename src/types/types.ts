import type { ConditionalKeys } from 'type-fest';

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
export type TGILiteral = {
	type: uint32;
	group: uint32;
	instance: uint32;
}
export type TGIQuery = Partial<TGILiteral>;

// A type that we often use to allow all non-function keys of a class to be 
// specified as options.
export type ConstructorOptions<T> = Omit<
	Partial<T>,
	ConditionalKeys<T, (...args: any[]) => any>
>;
