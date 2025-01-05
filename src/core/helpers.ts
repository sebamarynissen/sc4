// # helpers.ts
import { SmartBuffer } from 'smart-arraybuffer';
import type { uint32 } from 'sc4/types';
import crc32 from './crc.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import { FileType } from './enums.js';
import type Entry from './dbpf-entry.js';

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

// # readRecordsAsBuffers(entry)
// This function can be useful when decoding the savegame files. It accepts an 
// entry that consists out of multiple SIZE MEM CRC records, and returns the 
// array of raw buffers. Note that we return a shallow copy, so the underlying 
// memory is the same! It can be used to modify values of subfiles of which the 
// structure is not known yet.
export function readRecordsAsBuffers(entry: Entry): Uint8Array[] {
	let buffer = entry.decompress();

	// If the buffer can't even hold SIZE CRC MEM, then we skip it.
	if (buffer.byteLength < 12) return [];

	// If what we're interpreting as size is larged than the buffer, 
	// it's impossible that this has the structure "SIZE CRC MEM"!
	let reader = SmartBuffer.fromBuffer(buffer);
	let size = reader.readUInt32LE(0);
	if (size > buffer.byteLength) return [];

	// Note that there may be multiple records in this buffer. We're 
	// going to parse them one by one and calculate the checksum. If the 
	// checksum matches, we're considering them to have the structure 
	// "SIZE CRC MEM".
	let slice = buffer.subarray(8, size);
	let crc = crc32(slice);
	if (crc !== reader.readUInt32LE(4)) return [];

	// Allright, first entry is of type "SIZE MEM CRC", we assume that 
	// all following entries are as well.
	let records = [];
	records.push(reader.readUint8Array(size));
	let index = size;
	buffer = buffer.subarray(size);
	while (buffer.byteLength >= 12) {
		let reader = SmartBuffer.fromBuffer(buffer);
		let size = reader.readUInt32LE(0);
		records.push(
			reader.readUint8Array(size),
		);
		index += size;
		buffer = buffer.subarray(size);
	}
	return records;
}
