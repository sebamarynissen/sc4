// # types.ts
import type { Constructor } from 'type-fest';
import type FileType from './file-types.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type { uint32 } from 'sc4/types';

// Contains all *valid* file types, as uint32 numbers.
export type FileTypeValue = (typeof FileType)[keyof typeof FileType];
export type FileType = FileTypeValue;

// Some types that are shared, but specific to the core module.
export type FileTypeConstructor = Constructor<any> & {
	[kFileType]: FileTypeValue;
};
export type FileTypeInstance = InstanceType<FileTypeConstructor>;

// Files that are found in savegames go a little bit further than simply being 
// an instance of a class with the "type" symbol set: they also need to have a 
// memory address! That way we can ensure that they can be used in pointers.
export type SavegameRecord = FileTypeInstance & { mem: uint32 };
