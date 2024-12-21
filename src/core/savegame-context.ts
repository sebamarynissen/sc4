// # savemgae-context.ts
import type { dword } from 'sc4/types';
import type Savegame from './savegame.js';
import type Pointer from './pointer.js';
import { hex } from 'sc4/utils';
import { isArrayType } from './helpers.js';
import type { SavegameRecord } from './types.js';
import { SmartBuffer } from 'smart-arraybuffer';
import crc32 from './crc.js';

// # SavegameContext
// Class for providing some context around a savegame file. It is mainly used 
// for tracking memory addresses used in the savegame. This makes it possibly to 
// generate new memory addresses that are guaranteed to be unique, as well as to 
// dereference points that might appear in the savegame.
export default class SavegameContext {
	dbpf: Savegame;
	memRefs: Set<dword> = new Set();
	#mem = 1;

	// ## constructor(dbpf)
	constructor(dbpf: Savegame) {
		this.dbpf = dbpf;
		for (let { mem } of this.findAllMemRefs()) {
			this.memRefs.add(mem);
		}
	}

	// ## mem()
	// Returns a memory address (just a number) that is not in use in the 
	// savegame yet. This allows us to insert content in a savegame file while 
	// ensuring that the memory address of it won't conflict with another entry.
	mem(): dword {
		let ref = this.#mem++;
		while (this.memRefs.has(ref)) {
			ref = this.#mem++;
		}
		return ref;
	} 

	// ## deref(pointer)
	// Dereferences a pointer, meaning that we'll look up the entry in its 
	// corresponding subfile. Note that we don't use an index here, so for very 
	// large subfiles - such as the prop file - this is O(n) and can take up 
	// quite a bit of time! Consider indexing it first if you have to do this.
	deref<T extends SavegameRecord>(pointer: Pointer<T> | null): T {
		if (!pointer || pointer.type === 0x00000000) {
			throw new Error(`Trying to dereference a null pointer!`);
		}
		let { type, address } = pointer;
		let entry = this.dbpf.find({ type });
		if (!entry) {
			throw new Error(`Trying to dereference a pointer from subfile ${hex(type)}, which does not exist in the savegame!`);
		}
		let file = entry.read() as T | T[] | Uint8Array;
		if (file instanceof Uint8Array) {
			throw new Error(`Trying to dereference a ponter from a non-decoded subfile ${hex(type)}!`);
		}
		let result;
		if (!Array.isArray(file) || isArrayType(file)) {
			result = find([file], address) as T;
		} else {
			result = find(file, address);
		}
		if (!result) {
			throw new Error(`Trying to dereference a pointer to a non-existent record!`);
		}
		return result;
	}

	// ## findAllMemRefs()
	// Returns a list of all records (could be sub-records) in the dbpf that 
	// use a memory reference (i.e. have general structure SIZE CRC MEM). 
	// We're using the CRC to detect if this kind of entry works this way.
	findAllMemRefs(dbpf = this.dbpf) {

		let all = [];
		for (let entry of dbpf) {

			// If the buffer can't even hold SIZE CRC MEM, then we skip it.
			let buffer = entry.decompress();
			if (buffer.byteLength < 12) continue;

			// If what we're interpreting as size is larged than the buffer, 
			// it's impossible that this has the structure "SIZE CRC MEM"!
			let reader = SmartBuffer.fromBuffer(buffer);
			let size = reader.readUInt32LE(0);
			if (size > buffer.byteLength) continue;

			// Note that there may be multiple records in this buffer. We're 
			// going to parse them one by one and calculate the checksum. If the 
			// checksum matches, we're considering them to have the structure 
			// "SIZE CRC MEM".
			let slice = buffer.subarray(8, size);
			let crc = crc32(slice);
			if (crc !== reader.readUInt32LE(4)) continue;

			// Allright, first entry is of type "SIZE MEM CRC", we assume that 
			// all following entries are as well.
			all.push({
				mem: reader.readUInt32LE(8),
				type: entry.type,
				entry,
				index: 0,
			});
			let index = size;
			buffer = buffer.subarray(size);
			while (buffer.byteLength >= 12) {
				let reader = SmartBuffer.fromBuffer(buffer);
				let size = reader.readUInt32LE(0);
				let mem = reader.readUInt32LE(8);
				all.push({
					mem,
					type: entry.type,
					entry,
					index,
				});
				index += size;
				buffer = buffer.subarray(size);
			}

		}
		return all;
	}

}

// # find()
// Helper function for finding an object with the given address.
function find<T extends object>(array: T[], address: dword) {
	return array.find(record => {
		if (!('mem' in record)) return false;
		return record.mem === address;
	});
}
