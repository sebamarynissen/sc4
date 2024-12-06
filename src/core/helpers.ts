// # helpers.ts
import type { uint32 } from 'sc4/types';
import { kFileType } from './symbols.js';
import type { FileTypeConstructor } from './types.js'
import { FileType } from './enums.js';

// # getClassType(object)
// Inspects the object and returns its Type ID. If a class constructor is 
// specified, we hence return the type id of this constructor, if it's an 
// instance we look it up in the constructor.
export function getClassType(
	object: FileTypeConstructor | InstanceType<FileTypeConstructor>,
) {
	if (kFileType in object) {
		return object[kFileType];
	} else {
		return object.constructor[kFileType];
	}
}

// # getTypeLabel(value)
// Looks up the label of the given file type. If it is known, we return a 
// string, otherwise we return nothing.
export function getTypeLabel(value: uint32): string | undefined {
	const entries = Object.entries(FileType);
	return entries.find(([label, type]) => type === value)?.[0];
}
