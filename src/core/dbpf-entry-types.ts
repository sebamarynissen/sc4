// # dbpf-entry-types.ts
import type { ValueOf } from 'type-fest';
import type FileClasses from './file-classes.js';
import type { kFileTypeArray } from './symbols.js';

type DecodedFileClass = ValueOf<typeof FileClasses>;
type DecodedFile = InstanceType<DecodedFileClass>;
type ArraySignature = { [kFileTypeArray]: any; };
type ArrayFile = InstanceType<Extract<DecodedFileClass, ArraySignature>>;

/**
 * Figures out the return type of an Entry's read() and readAsync() functions. 
 * We automatically figure out whether the type is a (1) decoded type and (2) 
 * is an array Type.
 */
export type ReadResult<T> = T extends DecodedFile
	? T extends ArrayFile
	? T[]
	: T
	: Uint8Array;
