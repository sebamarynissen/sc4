// # dbpf-entry.ts
import { decompress } from 'qfs-compression';
import { tgi, inspect, duplicateAsync } from 'sc4/utils';
import type { uint32, TGILiteral } from 'sc4/types';
import type { ValueOf } from 'type-fest';
import type { InspectOptions } from 'node:util';
import WriteBuffer from './write-buffer.js';
import Stream from './stream.js';
import { getTypeLabel } from './helpers.js';
import type DBPF from './dbpf.js';
import FileClasses from './file-classes.js';
import FileType from './file-types.js';
import { kFileTypeArray } from './symbols.js';

// The .read() method of an entry will automatically look for known file types, 
// which means that a class has been implemented for it. In order to do this, we 
// first need a subset type that contains all values of the FileType enum that 
// have a corresponding class.
type KnownTypeId = (typeof FileType)[
	keyof typeof FileClasses & keyof typeof FileType
];

// A type that matches all of our registered file classes.
type FileConstructor = ValueOf<typeof FileClasses>;
type File = InstanceType<FileConstructor>;

// Create a mapped type that contains all the allowed *values* of the known file 
// types and maps them to the corresopnding keys where they can be found in the 
// FileClasses map.
type TypeIdToStringKey = {
	[K in keyof typeof FileClasses & keyof typeof FileType as (typeof FileType)[K]]: K;
};

// Contains all the types of the *instances* that are part of an array. This 
// means that we match stuff like "Lot", "Building" etc. More specifically, all 
// classes that define { static [kFileTypeArray] }
type ArrayFileTypeConstructor = Extract<ValueOf<typeof FileClasses>, {
	[ kFileTypeArray]: any;
}>;
type ArrayFileType = InstanceType<ArrayFileTypeConstructor>;

// Contains all file types that implement a `toBuffer()` method
type SerializableFileType = Extract<
	File,
	{ toBuffer: (...args: any[]) => Uint8Array }
>;

// A type that matches a constructor based on the *numeric* type id.
type ConstructorFromType<T extends KnownTypeId> = (typeof FileClasses)[TypeIdToStringKey[T]];

// A type that maps a known file type (a number) to an actual *instance type*.
type FileFromType<T extends KnownTypeId> = InstanceType<
	ConstructorFromType<T>
>;

// We still have to take into account that certain files - most notably savegame 
// files - are actually given as *arrays*. To detect this
type PossibleArray<T extends KnownTypeId> = 
	ConstructorFromType<T> extends { [kFileTypeArray]: any }
		? Array<FileFromType<T>>
		: FileFromType<T>;

// Generic type that we use to narrow down the entry to indicate that we know 
// the file type, but we don't know yet whether it is an array or not.
interface EntryOfPossibleArrayType<T extends File> extends Entry {
	read: () => T | T[];
	file: T | T[] | null;
	fileConstructor: FileConstructor;
}

// The main magic for the type narrowing happens here with an interface that 
// extends the entry and defines what the return type of the "read" function 
// becomes.
interface EntryOfType<T extends File | File[]> extends Entry {
	read: () => T;
	file: T | null;
}

// Generic type for when we know this entry is an array type. In that case we 
// know that the fileConstructor is for sure one of the array constructors.
interface EntryOfArrayType<T extends ArrayFileType> extends EntryOfType<T[]> {
	fileConstructor: ArrayFileTypeConstructor;
}

type EntryConstructorOptions = {
	dbpf?: DBPF;
};
type EntryParseOptions = {
    minor?: number;
    buffer?: Uint8Array | null;
};
type EntryFile = unknown;

// Invert the file types so that we can easily access a constructor by its 
// numeric id.
const map = new Map(
	Object.keys(FileClasses).map((key: keyof typeof FileClasses) => {
		let id = FileType[key];
		let constructor = FileClasses[key];
		return [id, constructor];
	}),
) as Map<number, FileConstructor>;

// # Entry
// A class representing an entry in the DBPF file. An entry is a descriptor of 
// a file in a DBPF, but not the file itself yet. In order to actually get the 
// file, you will need to call entry.read(). If the entry is of a known type, 
// it will be parsed appropriately.
export default class Entry {
	type: uint32;
	group: uint32 = 0;
	instance: uint32 = 0;
	fileSize = 0;
	compressedSize = 0;
	offset = 0;
	compressed = false;

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
	raw: Uint8Array | null;
	buffer: Uint8Array | null;
	file: unknown;

	// ## constructor(opts)
	constructor(opts: EntryConstructorOptions = {}) {
		let { dbpf, ...rest } = opts;
		Object.defineProperty(this, 'dbpf', {
			value: dbpf,
			enumerable: false,
			writable: false,
		});
		Object.assign(this, rest);
	}

	// ## isType()
	// A predicate function that allows us to narrow down what filetype this 
	// entry contains. Using this function will infer the return type of the 
	// `.read()` function.
	isType<T extends KnownTypeId>(type: T): this is EntryOfType<PossibleArray<T>>  {
		return this.type === type;
	}

	// ## isArrayType()
	// Returns whether this file type is registered as an array file type, 
	// meaning we'll automatically handle the array deserialization without the 
	// need for the file class itself to support this. Just implement a class 
	// for every item in the array.
	isArrayType(): this is EntryOfArrayType<ArrayFileType> {
		if (!this.fileConstructor) return false;
		return kFileTypeArray in this.fileConstructor;
	}

	// ## isSerializableType()
	// Returns whether this file type has implemented a `.toBuffer()` method. 
	// Not all entries need this because some entries might be read-only. In 
	// that case, there's no need to serialize them, we'll just re-use the 
	// buffer then.
	isSerializableType(): this is EntryOfPossibleArrayType<SerializableFileType> {
		if (!this.fileConstructor) return false;
		return 'toBuffer' in this.fileConstructor.prototype;
	}

	// ## get id()
	get id() {
		return tgi(this.type, this.group, this.instance);
	}

	// ## get tgi()
	get tgi() { return [this.type, this.group, this.instance]; }
	set tgi(tgi: [uint32, uint32, uint32] | TGILiteral) {
		if (Array.isArray(tgi)) {
			[this.type, this.group, this.instance] = tgi;
		} else {
			this.type = tgi.type;
			this.group = tgi.group;
			this.instance = tgi.instance;
		}
	}

	// ## get isRead()
	// Returns whether the entry was read into memory. When this happened, it 
	// means that the file might have been modified and hence we can't reuse the 
	// raw - potentially uncompressed - buffer.
	get isRead() {
		return !!this.raw || !!this.buffer;
	}

	// ## get isTouched()
	// Returns whether the entry was either read, *or* we do have a decoded 
	// file. This typically happens when adding a new file to a savegame - for 
	// example a prop file. If there were no props before, then the entry should 
	// still be included in the serialization!
	get isTouched() {
		return !!this.file || this.isRead;
	}

	// ## get fileConstructor()
	// Returns the class to use for this file type, regardless of whether this 
	// is an array type or not.
	get fileConstructor(): FileConstructor | undefined {
		return map.get(this.type);
	}

	// ## get isKnownType()
	// Returns whether the type of this entry is a known file type, meaning that 
	// a class has been registered for it that can properly parse the buffer.
	isKnownType(): this is EntryOfPossibleArrayType<File> {
		return map.has(this.type);
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
		this.type = rs.uint32() as KnownTypeId;
		this.group = rs.uint32();
		this.instance = rs.uint32();
		if (minor > 0) {
			rs.uint32();
		}
		let offset = this.offset = rs.uint32();
		this.compressedSize = rs.uint32();

		// Temporarilly set the fileSize to compressedSize. If the file is 
		// compressed though, we'll read this from the dir entry and update 
		// the file size accordingly. For non-compressed files, the fileSize 
		// remains ok.
		this.fileSize = this.compressedSize;

		// If a dbpf buffer was specified, extract the raw entry from it. 
		if (buffer) {
			this.raw = buffer.subarray(offset, offset+this.compressedSize);
		}
		return this;

	}

	// ## readRaw()
	// **Synchronously** reads the entry's raw buffer and stores it in the 
	// "raw" property.
	readRaw() {
		return this.dbpf.readBytes(this.offset, this.compressedSize);
	}

	// ## decompress()
	// Returns the decompressed raw entry buffer. If the entry is not 
	// compressed, then the buffer is returned as is.
	decompress(): Uint8Array {
		return dual.decompress.sync.call(this, () => this.readRaw());
	}

	// ## read()
	// Tries to convert the raw buffer of the entry into a known file type. If 
	// this fails, we'll simply return the raw buffer, but decompressed if the 
	// entry was compressed.
	read(): EntryFile {
		return dual.read.sync.call(this, () => this.decompress());
	}

	// ## readRawAsync()
	// Asynchronously reads the entry's raw buffer and stores it in the raw 
	// property.
	async readRawAsync() {
		return await this.dbpf.readBytesAsync(this.offset, this.compressedSize);
	}

	// ## decompressAsync()
	// Same as decompress, but asynchronously.
	async decompressAsync(): Promise<Uint8Array> {
		return dual.decompress.async.call(this, () => this.readRawAsync());
	}

	// ## readAsync()
	// Same as read, but in an async way.
	async readAsync(): Promise<EntryFile> {
		return dual.read.async.call(this, () => this.decompressAsync());
	}

	// ## toBuffer()
	// Converts the file that is attached to this entry to a buffer. Note that 
	// there are a few cases we have to take into account. The highest priority 
	// is obviously when the file was parsed, then we serialize the file back 
	// into a buffer.
	toBuffer(): Uint8Array {
		if (this.file && this.isSerializableType()) {
			if (Array.isArray(this.file)) {
				let buffer = new WriteBuffer();
				for (let file of this.file) {
					buffer.writeUint8Array(file.toBuffer());
				}
				return buffer.toUint8Array();
			} else {
				return this.file.toBuffer();
			}
		} else if (this.buffer) {
			return this.buffer;
		} else {
			return new Uint8Array();
		}
	}

	// ## toJSON()
	// Serializes the dbpf entry to json so that we can pass it around between 
	// threads.
	toJSON() {
		let {
			type,
			group,
			instance,
			fileSize,
			compressedSize,
			offset,
			compressed,
		} = this;
		return {
			type,
			group,
			instance,
			fileSize,
			compressedSize,
			offset,
			compressed,
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
			dbpf: this.dbpf.file,
			type: inspect.type(label) ?? inspect.hex(this.type),
			group: inspect.hex(this.group),
			instance: inspect.hex(this.instance),
			fileSize: this.fileSize,
			compressedSize: this.compressedSize,
			offset: this.offset,
			compressed: this.compressed,
			file: this.file,
			buffer: this.buffer,
			raw: this.raw,
		}, opts);
	}

}

type reader<T> = () => T | Promise<T>;
const dual = {

	// # decompress()
	// Decompressing an entry can be done in both a sync and asynchronous way, 
	// so we use the async duplicator function.
	decompress: duplicateAsync(function*(this: Entry, readRaw: reader<Uint8Array>) {

		// If we've already decompressed, just return the buffer as is.
		if (this.buffer) return this.buffer;

		// If we haven't read in the raw - potentially compressed - buffer, we 
		// have to do this first. Can be done synchronously, or asynchronously.
		if (!this.raw) {
			this.raw = (yield readRaw()) as Uint8Array;
		}

		// If the entry is compressed, decompress it.
		if (this.compressed) {
			this.buffer = decompress(this.raw.subarray(4));
		} else {
			this.buffer = this.raw;
		}

		return this.buffer;

	}),

	// # read()
	// Same for actually reading an entry. Can be done both sync and async.
	read: duplicateAsync(function*(this: Entry, decompress: reader<Uint8Array>) {

		if (this.isArrayType()) {
			console.log(this.file);
		}

		// If the entry was already read, don't read it again. Note that it's 
		// possible to dispose the entry to free up some memory if required.
		if (this.file !== null) {
			return this.file;
		}

		// If we don't have the buffer yet, we might need to decompress the raw 
		// contents first, meaning we might have to read the raw contents first 
		// as well.
		if (!this.buffer) {
			yield decompress();
		}

		// If the entry does not contain a known file type, just return the 
		// buffer as is.
		if (!this.isKnownType()) return this.buffer;

		// If the file type is actually an array file type, then it has been 
		// registered as [Constructor], in which case we need to read the file 
		// as an array. If nothing is found, just return the buffer. Third party 
		// code might still know how to interpret the buffer.
		if (this.isArrayType()) {
			const Constructor = this.fileConstructor;
			this.file = readArrayFile(Constructor, this.buffer!);
		} else {
			const Constructor = this.fileConstructor;
			let file = this.file = new Constructor();
			file.parse(new Stream(this.buffer!), { entry: this });
		}
		return this.file;

	}),

};

// # readArrayFile()
// Reads in a subfile of the DBPF that has an array structure. Typicaly examples 
// are the lot and prop subfiles.
function readArrayFile(Constructor: ArrayFileTypeConstructor, buffer: Uint8Array) {
	let array: ArrayFileType[] = [];
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