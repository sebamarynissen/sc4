// # dbpf-entry-types.ts
import type {
	ArrayFile,
	DecodedFile,
} from './types.js';

/**
 * Figures out the return type of an Entry's read() and readAsync() functions. 
 * We automatically figure out whether the type is a (1) decoded type and (2) 
 * is an array Type.
 */
export type ReadResult<T> = T extends DecodedFile
	? T extends ArrayFile
	? T[]
	: T
	: unknown;
