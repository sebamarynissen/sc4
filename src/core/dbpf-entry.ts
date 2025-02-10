// # dbpf-entry.ts
import { decompress } from 'qfs-compression';
import { tgi, inspect, getCompressionInfo } from 'sc4/utils';
import type { TGILike, uint32 } from 'sc4/types';
import type { Class } from 'type-fest';
import type { InspectOptions } from 'node:util';
import WriteBuffer from './write-buffer.js';
import Stream from './stream.js';
import { getTypeLabel } from './helpers.js';
import { getConstructorByType, hasConstructorByType } from './file-classes-helpers.js';
import type DBPF from './dbpf.js';
import { kFileTypeArray } from './symbols.js';
import type {
	DBPFFile as File,
	DecodedFileTypeId,
    TypeIdToFile,
    DecodedFile,
    ReadResult,
} from './types.js';
import TGI from './tgi.js';

/**
 * Returns a DBPF Entry type where the file type pointed to by the entry is 
 * inferred from the type id.
 * 
 * @param A file type id.
 */
export type EntryFromType<T extends DecodedFileTypeId> = Entry<TypeIdToFile<T>>;

export type EntryJSON = {
	tgi: uint32[];
	size: number;
	offset: number;
};

type EntryConstructorOptions = {
	tgi?: TGILike;
	dbpf?: DBPF;
	size?: number;
	offset?: number;
	compressed?: boolean;
};
type EntryParseOptions = {
    minor?: number;
    buffer?: Uint8Array | null;
};

// # Entry
// A class representing an entry in the DBPF file. An entry is a descriptor of 
// a file in a DBPF, but not the file itself yet. In order to actually get the 
// file, you will need to call entry.read(). If the entry is of a known type, 
// it will be parsed appropriately.
type AllowedEntryType = DecodedFile | Uint8Array;
export default class Entry<T extends AllowedEntryType = AllowedEntryType> {
	tgi: TGI;
	size = 0;
	offset = 0;

	// Whether an entry is compressed or not is no longer derived from the DIR 
	// file. That's because we need to be able to handle duplicates. Instead, 
	// you can check if an entry is compressed by checking whether its file 
	// header contains the 0x10fb magic number. This means that the "compressed" 
	// field now has a slightly different meaning. It now has three states, 
	// where "undefined" means that it's not known whether the entry is 
	// compressed or not. This means that upon saving, we will have to actually 
	// read tje buffer to figure out whether it's compressed or not.
	compressed: boolean | undefined = undefined;

	// This property is rebound as non-enumerable in the constructor, but it is 
	// needed for TypeScript to properly handle it.
	dbpf: DBPF;

	// Below are three properties that can represent the contents of the 
	// entry:
	//  - raw: this is the raw, potentially compressed buffer, as it 
	//    was found in the DBPF. This can be null if the entry was not read 
	//    from a DBPF, but generated programmatically.
	//  - buffer: contains a buffer with the binary contents of the entry, 
	//    always uncompressed. Can again be null if it was not read from a 
	//    DBPF.
	//  - file: contains the contents of the entry in parsed form. If a 
	//    certain file type is known and a class has been implemented for 
	//    this, it can be found here. It's mainly this property that you'll 
	//    be interfacing with to modify things in a certian subfile of the 
	//    DBPF as this means you don't have to work with the raw binary data.
	raw: Uint8Array | null = null;
	buffer: Uint8Array | null = null;
	file: ReadResult<T> | null = null;

	// Internal promises where we store the read promise.
	#readRawPromise: Promise<Uint8Array> | null = null;
	#decompressPromise: Promise<Uint8Array> | null = null;
	#readPromise: Promise<ReadResult<T>> | null = null;

	// ## constructor(opts)
	// Constructor for the entry. Note that we might have millions and millions 
	// of entries in very large plugin folders, so we optimize this as much as 
	// possible, which makes the code look a little bit uglier.
	constructor(opts: EntryConstructorOptions = {}) {
		this.tgi = opts.tgi ? new TGI(opts.tgi) : new TGI();
		if (opts.dbpf) this.dbpf = opts.dbpf;
		if (opts.offset) this.offset = opts.offset;
		if (opts.size) this.size = opts.size;
		if (opts.compressed !== undefined) this.compressed = opts.compressed;
	}

	// ## isType()
	// A predicate function that allows us to narrow down what filetype this 
	// entry contains. Using this function will infer the return type of the 
	// `.read()` function.
	// IMPORTANT! This needs to be a *generic* function. If we don't do this,
	// but set type: DecodedFileTypeId instead, then the predicate returns 
	// Exemplar | Lot[] | Prop[] ... By using a *generic* type, we narrow this 
	// down properly! This is a bit subtle to grasp, I know!
	isType<T extends DecodedFileTypeId>(type: T): this is EntryFromType<T> {
		return this.type === type;
	}

	// ## isArrayType()
	// Returns whether this file type is registered as an array file type, 
	// meaning we'll automatically handle the array deserialization without the 
	// need for the file class itself to support this. Just implement a class 
	// for every item in the array.
	isArrayType() {
		if (!this.fileConstructor) return false;
		return kFileTypeArray in this.fileConstructor;
	}

	get type() { return this.tgi.type; }
	get group() { return this.tgi.group; }
	get instance() { return this.tgi.instance; }

	// ## get id()
	// The "id" returns a stringified version of the tgi of the entry, which is 
	// useful for indexing it.
	get id() {
		return tgi(this.type, this.group, this.instance);
	}

	// ## get isRead()
	// Returns whether the entry was read into memory. When this happened, it 
	// means that the file might have been modified and hence we can't reuse the 
	// raw - potentially uncompressed - buffer.
	get isRead() {
		return !!this.raw || !!this.buffer;
	}

	// ## isTouched()
	// Returns whether the entry was either read, *or* we do have a decoded 
	// file. This typically happens when adding a new file to a savegame - for 
	// example a prop file. If there were no props before, then the entry should 
	// still be included in the serialization!
	isTouched() {
		return !!this.file || this.isRead;
	}

	// ## get fileConstructor()
	// Returns the class to use for this file type, regardless of whether this 
	// is an array type or not.
	get fileConstructor() {
		return getConstructorByType(this.type);
	}

	// ## get isKnownType()
	// Returns whether the type of this entry is a known file type, meaning that 
	// a class has been registered for it that can properly parse the buffer.
	isKnownType(): this is Entry<DecodedFile> {
		return hasConstructorByType(this.type);
	}

	// ## free()
	// Frees up the memory the entry is taking up. Useful when DBPFs get 
	// unloaded to not take up too much memory.
	free() {
		this.raw = null;
		this.file = null;
		return this;
	}

	// ## parse(rs, opts)
	// Parses the entry from the given stream-wrapper buffer.
	parse(rs: Stream, opts: EntryParseOptions = {}): this {
		const {
			minor = 0,
			buffer = null,
		} = opts;
		this.tgi = rs.tgi();
		if (minor > 0) {
			rs.uint32();
		}
		let offset = this.offset = rs.uint32();
		this.size = rs.size();

		// If a dbpf buffer was specified, extract the raw entry from it. 
		if (buffer) {
			this.raw = buffer.subarray(offset, offset+this.size);
		}
		return this;

	}

	// ## readRaw()
	// **Synchronously** reads the entry's raw buffer and stores it in the 
	// "raw" property.
	readRaw(): Uint8Array {
		if (this.raw) return this.raw;
		return this.raw = this.dbpf.readBytes(this.offset, this.size);
	}

	// ## decompress()
	// Returns the decompressed raw entry buffer. If the entry is not 
	// compressed, then the buffer is returned as is.
	decompress(): Uint8Array {
		if (this.buffer) return this.buffer;
		if (!this.raw) this.readRaw();
		return this.#doDecompress();
	}

	// ## doDecompress()
	// Contains the shared logic for decompressing.
	#doDecompress() {
		const { raw } = this as { raw: Uint8Array };
		const info = getCompressionInfo(raw);
		if (info.compressed) {
			this.compressed = true;
			this.buffer = decompress(raw.subarray(4));
		} else {
			this.compressed = false;
			this.buffer = raw;
		}
		return this.buffer;
	}

	// ## read()
	// Tries to convert the raw buffer of the entry into a known file type. If 
	// this fails, we'll simply return the raw buffer, but decompressed if the 
	// entry was compressed.
	read(): ReadResult<T> {
		if (this.file) return this.file;
		if (!this.buffer) this.decompress();
		return this.#doRead(this.buffer!);
	}

	// ## readRawAsync()
	// Asynchronously reads the entry's raw buffer and stores it in the raw 
	// property.
	async readRawAsync() {
		if (this.raw) return this.raw;
		if (this.#readRawPromise) return await this.#readRawPromise;
		this.#readRawPromise = this.dbpf.readBytesAsync(this.offset, this.size)
			.then(raw => {
				this.#readRawPromise = null;
				this.raw = raw;
				return raw;
			});
		return await this.#readRawPromise;
	}

	// ## decompressAsync()
	// Same as decompress, but asynchronously.
	async decompressAsync(): Promise<Uint8Array> {
		if (this.buffer) return this.buffer;
		if (this.#decompressPromise) return await this.#decompressPromise;
		this.#decompressPromise = new Promise(async (resolve) => {
			if (!this.raw) await this.readRawAsync();
			resolve(this.#doDecompress());
		});
		return await this.#decompressPromise;
	}

	// ## readAsync()
	// Same as read, but in an async way.
	async readAsync(): Promise<ReadResult<T>> {
		if (this.file) return this.file;
		if (this.#readPromise) return await this.#readPromise;
		this.#readPromise = (async () => {
			if (!this.buffer) await this.decompressAsync();
			return this.#doRead(this.buffer as Uint8Array);
		})();
		return await this.#readPromise;
	}

	// # doRead(buffer)
	// The functionality that is shared between sync and async reading. This 
	// will actually parse the file object from the raw buffer once we have it.
	#doRead(buffer: Uint8Array): ReadResult<T> {

		// If the entry does not contain a known file type, just return the 
		// buffer as is.
		if (!this.isKnownType()) return buffer as any;

		// If the file type is actually an array file type, then it has been 
		// registered as [Constructor], in which case we need to read the file 
		// as an array. If nothing is found, just return the buffer. Third party 
		// code might still know how to interpret the buffer.
		if (this.isArrayType()) {
			const Constructor = this.fileConstructor!;
			this.file = readArrayFile(Constructor, buffer) as any;
		} else {
			const Constructor = this.fileConstructor!;
			const file = this.file = new Constructor() as any;
			try {
				file.parse(new Stream(this.buffer!), { entry: this });
			} catch (e) {
				console.log(this);
				console.log(this.buffer, this.raw);
				throw e;
			}
		}
		return this.file!;

	}

	// ## toBuffer()
	// Converts the file that is attached to this entry to a buffer. Note that 
	// there are a few cases we have to take into account. The highest priority 
	// is obviously when the file was parsed, then we serialize the file back 
	// into a buffer.
	toBuffer(): Uint8Array {
		if (Array.isArray(this.file) && !('toBuffer' in this.file)) {
			let array = this.file as File[];
			let buffer = new WriteBuffer();
			for (let file of array) {

				// If we notice *at runtime* that the array contains read-only 
				// files, then we won't serialize one by one, but return a 
				// buffer instead.
				if (!isSerializableFile(file)) {
					return this.buffer || new Uint8Array();
				}
				buffer.writeUint8Array(file.toBuffer());

			}
			return buffer.toUint8Array();
		} else if (this.file !== null) {
			let struct = this.file as File;
			if (!isSerializableFile(struct)) {
				return this.buffer || new Uint8Array();
			}
			return struct.toBuffer();
		} else {
			return this.buffer || new Uint8Array();
		}
	}

	// ## toJSON()
	// Serializes the dbpf entry to json so that we can pass it around between 
	// threads.
	toJSON(): EntryJSON {
		let {
			tgi,
			size,
			offset,
		} = this;
		return {
			tgi: [...tgi],
			size,
			offset,
		};
	}

	// ## [util.inspect.custom](depth, opts, inspect)
	// If we console.log an entry in node we want to convert the TGI to their 
	// hex equivalents so that it's easier to debug.
	[Symbol.for('nodejs.util.inspect.custom')](
		_depth: number,
		opts: InspectOptions,
		defaultInspect: Function,
	) {
		let label = getTypeLabel(this.type);
		return 'DBPF Entry '+defaultInspect({
			dbpf: this.dbpf?.file,
			type: inspect.type(label) ?? inspect.hex(this.type),
			tgi: this.tgi,
			size: this.size,
			offset: this.offset,
			compressed: this.compressed,
			file: this.file,
			buffer: this.buffer,
			raw: this.raw,
		}, opts);
	}

}

// # isSerializableFile(file)
// Figures out whether the file instance is serializable. During development 
// it's possible that a certain file type did not implement a `.toBuffer()` 
// method yet, which is fine, we'll re-use the original buffer then, meaning 
// that we can't make any changes - hence "readonly".
type SerializableFile = { toBuffer(): Uint8Array };
function isSerializableFile(file: object): file is SerializableFile {
	return 'toBuffer' in file;
}

// # readArrayFile()
// Reads in a subfile of the DBPF that has an array structure. Typicaly examples 
// are the lot and prop subfiles.
function readArrayFile<T extends Class<any>>(
	Constructor: T,
	buffer: Uint8Array
) {
	let array: InstanceType<T>[] = [];
	let rs = new Stream(buffer);
	while (rs.remaining() > 0) {

		// IMPORTANT! We read the size, but when reading the buffer to parse the 
		// entry from, we have to make sure the size is still included! It is an 
		// integral part of it!
		let size = rs.dword(rs.readOffset);
		let slice = rs.read(size);
		let child = new Constructor();
		child.parse(new Stream(slice));
		array.push(child);

	}
	return array;
}
