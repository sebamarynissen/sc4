// # exemplar-properties-types.ts
// This file contains the type wizardry to automatically figure out the types 
// when reading exemplar properties. The exemplar-properties object is what does 
// the magic for us.
import type { uint32, uint16, uint8, sint32, sint64, float } from 'sc4/types';
import type {
	ExemplarPropertyIdLikeToValueType as Map,
	kPropertyType,
	kPropertyId,
	StringKey,
} from './exemplar-properties.js';
export type { kPropertyType, kPropertyId };

export type NumberLike<T extends number = number> =
	| T
	| { [kPropertyId]: T; }
	| { [Symbol.toPrimitive](...args: any[]): T; };
export type ExtractNumber<N> = N extends NumberLike<infer T> ? T : N;

export type Primitive = 
	| uint8
	| uint16
	| uint32
	| sint32
	| sint64
	| float
	| boolean;
export type ValueType =
	| string
	| Primitive
	| Primitive[];

/**
 * Either a string, a number or an object that can be converted to a number 
 * which identifies a certain property.
 */
export type Key = StringKey | NumberLike;

// This is what it's all about: it returns the type of the value a property 
// holds based on its numerical or string id. Using a map is far, far easier 
// than TypeScript gymnastics.
/**
 * A generic type that figures out the type of a property's value in case it is 
 * a known value.
 */
export type Value<K extends Key = number> = K extends NumberLike
		? Map<ExtractNumber<K>, ValueType>
		: Map<K, ValueType>;

/**
 * Determines whether the given key can serve as an exemplar property key.
 * 
 * @{param} key {unknown}
 */
export function isKey(key: unknown): key is Key {
	if (typeof key === 'number' || typeof key === 'string') {
		return true;
	} else if (typeof key === 'object' && key !== null) {
		return Symbol.toPrimitive in key;
	} else {
		return false;
	}
}
