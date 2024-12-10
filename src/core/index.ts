// # index.js
export * from './enums.js';
export * from './symbols.js';
export { default as DBPF } from './dbpf.js';
export { default as Savegame } from './savegame.js';
export { default as LotObject } from './lot-object.js';
export { getTypeLabel } from './helpers.js';

// Export all file classes. Third parties need to be able to use them all 
// obviously as they can be added to a dbpf.
export * from './file-classes.js';

// Export more core data structures that third parties might use.
export { default as Color } from './color.js';
export { default as Vertex } from './vertex.js';
export { default as Pointer } from './pointer.js';

// Export relevant types.
export type { DBPFOptions, DBPFSaveOptions, DBPFJSON } from './dbpf.js';
export type {
	default as Entry,
	EntryWithReadResult,
	TypeIdToEntry,
	EntryJSON,
} from './dbpf-entry.js';
export type {
	DBPFFile,
	SavegameRecord,
	SavegameObject,
	FileTypeId,
	FileTypeName,
	DecodedFileTypeId,
	DecodedFileTypeName,
	SimGridFileType,
} from './types.js';
