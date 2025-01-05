// # savemgae-context.ts
import type { dword } from 'sc4/types';
import type Savegame from './savegame.js';
import Pointer from './pointer.js';
import { hex } from 'sc4/utils';
import { isArrayType, readRecordsAsBuffers } from './helpers.js';
import type { DecodedFile, SavegameRecord } from './types.js';
import { SmartBuffer } from 'smart-arraybuffer';
import type Entry from './dbpf-entry.js';
import { cClass } from './enums.js';

type DecodedSavegameRecord = DecodedFile & SavegameRecord;
type RecordRow = {
	entry: Entry;
	type: number;
	label: string;
	records: RecordInfo[];
};
type RecordInfo = {
	pointer: Pointer;
	offset: number;
	buffer: Uint8Array;
	record: DecodedSavegameRecord | undefined;
};

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
		for (let { pointer } of this.getFlatRecordList()) {
			this.memRefs.add(pointer.address);
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
	deref<T extends SavegameRecord | Uint8Array>(pointer: Pointer<T> | null): T {
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
			let buffers = readRecordsAsBuffers(entry);
			let record = buffers.find(buffer => {
				let reader = SmartBuffer.fromBuffer(buffer);
				let mem = reader.readUInt32LE(8);
				return mem === address;
			});
			if (!record) {
				throw new Error(`Trying to dereference a pointer to a non-existent record!`);
			}
			return record as T;
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
		return result as T;
	}

	// Kept for legacy purposes, but we'd like to get rid of this.
	findAllMemRefs(dbpf = this.dbpf): any {
		let all = [];
		let list = this.getRecordList();
		for (let { type, records, entry } of list) {
			for (let record of records) {
				all.push({
					mem: record.pointer.address,
					type,
					entry,
					index: record.offset,
				});
			}
		}
		return all;
	}

	// ## getRecordList()
	// Returns a list of all records (could be sub-records) in the dbpf that 
	// use a memory reference (i.e. have general structure SIZE CRC MEM). 
	// We're using the CRC to detect if this kind of entry works this way.
	getRecordList(dbpf = this.dbpf): RecordRow[] {
		let all: RecordRow[] = [];
		for (let entry of dbpf) {

			// If the entry does not follow the SIZE CRC MEM convention, then we 
			// don't include it.
			let buffers = readRecordsAsBuffers(entry);
			if (buffers.length === 0) continue;

			// Parse the entry. If it's not a Uint8Array, then we'll have to 
			// include it as well.
			let files: any = entry.read();
			if (files instanceof Uint8Array) {
				files = undefined;
			} else {
				if (!Array.isArray(files) || !isArrayType(files)) {
					files = [files];
				}
			}

			// Create the rows.
			let row: RecordRow = {
				entry,
				type: entry.type,
				label: cClass[entry.type as keyof typeof cClass],
				records: [],
			};
			let offset = 0;
			for (let i = 0; i < buffers.length; i++) {
				let buffer = buffers[i];
				let address = SmartBuffer.fromBuffer(buffer).readUInt32LE(8);
				let record = files ? files[i] as DecodedSavegameRecord : undefined;
				row.records.push({
					pointer: new Pointer(entry.type, address),
					offset,
					buffer,
					record,
				});
				offset += buffer.byteLength;
			}
			all.push(row);

		}
		return all;
	}

	// ## getFlatRecordList()
	getFlatRecordList() {
		let list = this.getRecordList();
		return list.map(row => row.records).flat();
	}

	// ## getRecordCountTable()
	getRecordCountTable() {
		let list = this.getRecordList();
		return list.map(row => {
			return {
				name: row.label,
				count: row.records.length,
			};
		});
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
