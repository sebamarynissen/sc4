import FileClasses from './file-classes.js';
import { FileType } from './enums.js';
import type { Class } from 'type-fest';
import type { DecodedFileClass, DecodedFileTypeId, TypeIdToFileConstructor } from './types.js';

// Invert the file types so that we can easily access a constructor by its 
// numeric id.
const map = new Map(
	Object.keys(FileClasses).map((key: keyof typeof FileClasses) => {
		let id = FileType[key];
		let constructor = FileClasses[key];
		return [id, constructor];
	}),
) as Map<number, DecodedFileClass>;

export function getConstructorByType<T extends DecodedFileTypeId>(type: T): TypeIdToFileConstructor<T>;
export function getConstructorByType(type: number): Class<unknown> | undefined;
export function getConstructorByType(type: number): Class<unknown> | undefined {
	return map.get(type);
}

export function hasConstructorByType<T extends DecodedFileTypeId>(type: T): true;
export function hasConstructorByType(type: number): boolean;
export function hasConstructorByType(type: number): boolean {
	return map.has(type);
}


// # isType(object, type)
export function isType<T extends DecodedFileTypeId>(object: object, type: T)
	: object is InstanceType<TypeIdToFileConstructor<T>>
{
	let constructor = getConstructorByType(type);
	return object instanceof constructor;
}
