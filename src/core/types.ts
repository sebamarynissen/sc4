// # types.ts
import type { uint32, ConstructorOptions as Options } from 'sc4/types';
import type {
	FileType,
	SavegameFileType,
	SimGridFileType,
} from './file-types.js';
import type FileClasses from './file-classes.js';
import type Stream from './stream.js';
import type { ValueOf } from 'type-fest';
import type { kFileTypeArray } from './symbols.js';
import type TractInfo from './tract-info.js';
import type { Vector3, Vector3Like } from './vector-3.js';
import type Box3 from './box-3.js';

// Contains the type definition that a class implementing a DBPF file should 
// minimally adhere to. The only requirement here is that it can be parsed from 
// a readable stream. Note that it might optionally accept a buffer as well, but 
// that is no hard requirement.
export type DBPFFile = {
	parse(rs: Stream, ...args: any[]): any;
};

// Files that are found in Savegames are DBPFFiles, but they are also required 
// to have a "mem" field set so that they can be referenced inside the savegame 
// with pointers.
export type SavegameRecord = DBPFFile & { mem: uint32 };

// Certain savegame records are also required to have some information about 
// their bounding box - given as xMinTract etc. We'll call these SavegameObjects. 
// Typical examples are Buildings, Props, Flora, etc. Basically anything that 
// can be added to the item index.
export type SavegameObject = SavegameRecord & { tract: TractInfo };

// All savegame file type ids.
export type SavegameFileTypeId = ValueOf<typeof SavegameFileType>;

// The FileTypeId is a literal type that contains all *known* type ids, as 
// definied in the file-types.ts file. Note that it does not necessarily mean 
// that it also has a file class associated with it.
export type FileTypeId = (typeof FileType)[keyof typeof FileType];

// File types that have been decoded, and hence a file class associated with 
// them are stored in the literal file type "DecodedFileTypeId".
export type DecodedFileTypeId = (typeof FileType)[
	keyof typeof FileClasses & keyof typeof FileType
];

// Contains the *constructors* of all the decoded file classes.
export type DecodedFileClass = ValueOf<typeof FileClasses>;
export type DecodedFile = InstanceType<DecodedFileClass>;
type ArraySignature = { [kFileTypeArray]: any; };
export type ArrayFile = InstanceType<Extract<DecodedFileClass, ArraySignature>>;

// A literal type containing the type ids of the simgrids.
export type SimGridFileType = (typeof SimGridFileType)[keyof typeof SimGridFileType];

// Some dbpf files - mostly savegame files - are actually arrays of those 
// structures. The entry class needs to know this, so we use a literal type for 
// that as well.
type TypeIdToStringKey = {
	[K in keyof typeof FileClasses & keyof typeof FileType as typeof FileType[K]]: K;
};
export type TypeIdToFileConstructor<T extends DecodedFileTypeId> = typeof FileClasses[TypeIdToStringKey[T]];
export type ArrayFileTypeId = ValueOf<{
	[K in DecodedFileTypeId]: TypeIdToFileConstructor<K> extends {
		[kFileTypeArray]: any
	} ? K : never;
}>;

// Sometimes we'd also like to reference file types using their string names, as 
// that avoids having to import FileType all the time. Hence we create a literal 
// type for this as well.
export type FileTypeName = [keyof typeof FileType];
export type DecodedFileTypeName = [
	keyof typeof FileClasses & keyof typeof FileType
];
