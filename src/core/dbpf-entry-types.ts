// # dbpf-entry-types.ts
import type FileType from './file-types.js';
import type FileClasses from './file-classes.js';
import type {
	ArrayFile,
	DecodedFile,
	DecodedFileTypeId,
} from './types.js';

/**
 * Figures out the return type of an Entry's read() and readAsync() functions. 
 * We automatically figure out whether the type is a (1) decoded type and (2) 
 * is an array Type.
 */
export type ReadResult<T> = T extends number
	? T extends DecodedFileTypeId
		? ReadResultHelper<TypeIdToFile<T>>
		: unknown
	: ReadResultHelper<T>;

// Helper type for the ReadResult generic type so that we can call it as a function.
type ReadResultHelper<T> = T extends DecodedFile
	? T extends ArrayFile
	? T[]
	: T
	: unknown;

type TypeIdToStringKey = {
	[K in keyof typeof FileClasses & keyof typeof FileType as (typeof FileType)[K]]: K;
};

/**
 * Returns the decoded file as a *type* - i.e. "Lot", "Exemplar", ... based on 
 * its numerical Type ID.
 */
export type TypeIdToFile<T extends DecodedFileTypeId> = InstanceType<
	typeof FileClasses[TypeIdToStringKey[T]]
>;
