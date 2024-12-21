// # helpers.ts
import type { uint32 } from 'sc4/types';
import { kFileType, kFileTypeArray } from './symbols.js';
import { FileType } from './enums.js';

// # getClassType(object)
// Inspects the object and returns its Type ID. If a class constructor is 
// specified, we hence return the type id of this constructor, if it's an 
// instance we look it up in the constructor.
export function getClassType(object: object): number {
	if (kFileType in object) {
		return object[kFileType] as number;
	} else if (kFileType in object.constructor) {
		return object.constructor[kFileType] as number;
	} else {
		return 0;
	}
}

// # isArrayType(object)
// Returns whether the given object is an array type subfile.
export function isArrayType(object: object): boolean {
	if (kFileTypeArray in object) {
		return !!object[kFileTypeArray];
	} else if (kFileTypeArray in object.constructor) {
		return !!object.constructor[kFileTypeArray];
	} else {
		return false;
	}
}

// # getTypeLabel(value)
// Looks up the label of the given file type. If it is known, we return a 
// string, otherwise we return nothing.
export function getTypeLabel(value: uint32): string | undefined {
	const entries = Object.entries(FileType);
	return entries.find(([, type]) => type === value)?.[0];
}
