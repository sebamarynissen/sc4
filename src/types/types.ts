import type { ConditionalExcept } from 'type-fest';

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

// We often want to accept all non-function properties of a class constructor. 
// This helper type ensures this.
export type ConstructorOptions<T> = Partial<ConditionalExcept<T, Function>>;
