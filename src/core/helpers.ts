// # helpers.ts
import type { uint32 } from 'sc4/types';
import type { Class } from 'type-fest';
import { kFileType } from './symbols.js';
import { FileType } from './enums.js';
import FileClasses from './file-classes.js';
import type { DBPFFile, DecodedFileTypeId } from './types.js';
import type { TypeIdToFileConstructor } from './dbpf-entry.js';

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

// # getTypeLabel(value)
// Looks up the label of the given file type. If it is known, we return a 
// string, otherwise we return nothing.
export function getTypeLabel(value: uint32): string | undefined {
	const entries = Object.entries(FileType);
	return entries.find(([, type]) => type === value)?.[0];
}


// Invert the file types so that we can easily access a constructor by its 
// numeric id.
const map = new Map(
	Object.keys(FileClasses).map((key: keyof typeof FileClasses) => {
		let id = FileType[key];
		let constructor = FileClasses[key];
		return [id, constructor];
	}),
) as Map<number, Class<DBPFFile>>;

export function getConstructorByType<T extends DecodedFileTypeId>(type: T): TypeIdToFileConstructor<T>;
export function getConstructorByType(type: number): Class<DBPFFile> | undefined;
export function getConstructorByType(type: number): Class<DBPFFile> | undefined {
	return map.get(type);
}

export function hasConstructorByType<T extends DecodedFileTypeId>(type: T): true;
export function hasConstructorByType(type: number): boolean;
export function hasConstructorByType(type: number): boolean {
	return map.has(type);
}
