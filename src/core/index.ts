// # index.js
export * from './enums.js';
export * from './symbols.js';
export { default as DBPF } from './dbpf.js';
export { default as DBPFStream } from './dbpf-stream.js';
export { default as Savegame } from './savegame.js';
export { default as SavegameContext } from './savegame-context.js';
export { default as TGI } from './tgi.js';
export { default as LotObject } from './lot-object.js';
export * from './fsh.js';
export { getTypeLabel } from './helpers.js';

// Export all file classes. Third parties need to be able to use them all 
// obviously as they can be added to a dbpf.
export * from './file-classes.js';

// Export more core data structures that third parties might use.
export { default as SimulatorDate } from './simulator-date.js';
export { default as Color } from './color.js';
export { default as Vertex } from './vertex.js';
export { default as Pointer } from './pointer.js';
export { default as Vector3, type Vector3Like } from './vector-3.js';
export { default as Box3 } from './box-3.js';
export { default as NetworkCrossing } from './network-crossing.js';
export { NetworkIndexTile } from './network-index.js';

// Export relevant types.
export type { DBPFOptions, DBPFSaveOptions, DBPFJSON } from './dbpf.js';
export { default as Entry } from './dbpf-entry.js';
export type {
	EntryFromType,
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
	ArrayFileTypeId,
	SavegameFileTypeId,
} from './types.js';

export type {
	Key as ExemplarPropertyKey,
} from './exemplar-properties-types.js';
export type { ExemplarLike } from './exemplar.js';
