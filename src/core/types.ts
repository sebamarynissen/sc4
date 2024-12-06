// # types.ts
import type { Constructor } from 'type-fest';
import type FileType from './file-types.js';
import { kFileType, kFileTypeArray } from './symbols.js';

export type FileTypeValue = (typeof FileType)[keyof typeof FileType];

// Some types that are shared, but specific to the core module.
export type FileTypeConstructor = Constructor<any> & {
	[kFileType]: FileTypeValue;
};

export type FileTypeArrayClass = FileTypeConstructor & {
	[kFileTypeArray]: true;
};
