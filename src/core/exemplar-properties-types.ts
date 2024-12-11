// # exemplar-properties-types.ts
// This file contains the type wizardry to automatically figure out the types 
// when reading exemplar properties. The exemplar-properties object is what does 
// the magic for us.
import type { ValueOf } from 'type-fest';
import type { uint32, uint16, uint8, sint32, float, sint64 } from 'sc4/types';
import type {
	ExemplarProperty,
	kPropertyId,
	kPropertyType,
} from './exemplar-properties.js';

type P = typeof ExemplarProperty;
export type NumberLike<T extends number> =
	| T
	| { [kPropertyId]: T; }
	| { [Symbol.toPrimitive](...args: any[]): T; };

export type ExtractNumberLike<N> = N extends NumberLike<infer T> ? T : never;
export type ExemplarPropertyName = keyof P;
export type ExemplarPropertyId = ValueOf<{
	[K in keyof typeof ExemplarProperty]: ExtractNumberLike<typeof ExemplarProperty[K]>
}>;
export type ExemplarPropertyIdLike = ExemplarPropertyName | ExemplarPropertyId;

// This generic type accepts both a numeric id or a string and ensures we return 
// a proper *numeric id*.
export type ExemplarPropertyLikeToId<T extends ExemplarPropertyIdLike> =
	T extends ExemplarPropertyId
		? T
		: T extends ExemplarPropertyName
		? ExtractNumberLike<typeof ExemplarProperty[T]>
		: never;

// Invert the exemplar properties so that we can easily find information basde 
// on *numeric id*.
export type ExemplarPropertyIdToName<T extends ExemplarPropertyId> = {
	[K in keyof P as ExtractNumberLike<P[K]>]: K;
}[T];

export type ExemplarPropertyIdLikeToValue<T extends ExemplarPropertyIdLike> =
	T extends ExemplarPropertyName
		? P[T]
		: T extends ExemplarPropertyId
		? P[ExemplarPropertyIdToName<T>]
		: never;

type Unwrap<T> = T extends readonly (infer U)[] ? U : T;

type ExtractPrimitiveType<T> = T extends typeof Uint32Array
	? uint32
	: T extends typeof Uint16Array
	? uint16
	: T extends typeof Uint8Array
	? uint8
	: T extends typeof Int32Array
	? sint32
	: T extends typeof Float32Array
	? float
	: T extends typeof BigInt64Array
	? sint64
	: T extends Boolean
	? boolean
	: never;

type HasTypeKey = { [kPropertyType]: any };
type ExtractTypeSymbol<T extends HasTypeKey> = T[typeof kPropertyType];

type ExtractType<T extends number | HasTypeKey> =
	T extends number
		? uint32
		: T extends HasTypeKey
		? (
			ExtractTypeSymbol<T> extends typeof String
			? string
			: ExtractTypeSymbol<T> extends readonly any[]
			? ExtractPrimitiveType<Unwrap<ExtractTypeSymbol<T>>>[]
			: ExtractPrimitiveType<ExtractTypeSymbol<T>>
		) : never;

export type ExemplarPropertyIdLikeToType<T extends ExemplarPropertyIdLike> =
	ExtractType<ExemplarPropertyIdLikeToValue<T>>;
