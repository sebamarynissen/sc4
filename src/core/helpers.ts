// # helpers.ts
import { kFileType } from './symbols.js';
import type { FileTypeConstructor } from './types.js'

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
