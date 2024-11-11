// # dbpf.js
import { Buffer } from 'buffer';
import { compress } from 'qfs-compression';
import { isUint8Array } from 'uint8array-extras';
import { register } from './filetype-map.js';
import Header from './dbpf-header.js';
import Entry from './dbpf-entry.js';
import DIR from './dir.js';
import WriteBuffer from './write-buffer.js';
import Stream from './stream.js';
import crc32 from './crc.js';
import { cClass, FileType } from './enums.js';
import { fs, TGIIndex, duplicateAsync } from 'sc4/utils';

// # DBPF()
// A class that represents a DBPF file. A DBPF file is basically just a custom 
// file archive format, a bit like .zip etc. as it contains other files that 
// might be compressed etc.
export default class DBPF {

	// ## constructor(opts)
	// Constructs the dbpf for the given file. For backwards compatibility and 
	// ease of use, a DBPF is synchronous by default, but we should support 
	// async parsing as well: that's important if we're reading in an entire 
	// plugins directory for example. Note that DBPF's are always constructed 
	// from files, **not** from buffers. As such we don't have to keep the 
	// entire buffer in memory and we can read the required parts of the file 
	// "on the fly". That's what the DBPF format was designed for!
	constructor(opts = {}) {

		// If the file specified is actually a buffer, store that we don't 
		// have a file. Note that this is not recommended: we need to be able 
		// to load and unload DBPFs on the fly because we simply cannot load 
		// them all into memory!
		if (isUint8Array(opts)) {
			this.file = null;
			this.buffer = opts;
		} else if (typeof opts === 'string') {
			this.file = opts;
			this.buffer = null;
		} else {
			let { file = null, buffer = null } = opts;
			this.file = file;
			this.buffer = buffer;
		}

		// Create an empty header.
		this.header = new Header();

		// Create the index that keeps track of which entry - identified by 
		// TGI - is found where.
		this.entries = new TGIIndex();

		// If the user initialize the DBPF with either a file or a buffer, then 
		// parse immediately.
		let { parse = true } = opts;
		if (parse && (this.buffer || this.file)) {
			this.parse();
		}

	}

	// ## get length()
	get length() {
		return this.entries.length;
	}

	// ## find(...args)
	// Proxies to entries.find()
	find(...args) {
		return this.entries.find(...args);
	}

	// ## findAll(...args)
	// Proxies to entries.findAll()
	findAll(...args) {
		return this.entries.findAll(...args);
	}

	// ## add(tgi, file)
	// Adds the given file to the DBPF with the specified tgi.
	add(tgi, file) {
		let entry = new Entry(this);
		entry.tgi = tgi;
		this.entries.add(entry);
		if (isUint8Array(file)) {
			entry.buffer = file;
		} else if (file) {
			entry.file = file;
		}
		return entry;
	}

	// ## free()
	// This method unloads the underlying buffer of the dbpf so that it can be 
	// garbage collected to free up some memory. This is useful if we just 
	// needed the DBPF for indexing but are not planning to use it soon. In 
	// that case the cache can decide to free up the dbpf and only read it in 
	// again upon the next read.
	free() {
		if (!this.file) {
			console.warn([
				'No file is set.',
				'This means you will no longer be able to use this DBPF!',
			].join(' '));
		}

		// Delete the buffer & loop all our entries so that we unload those as 
		// well.
		this.buffer = null;
		for (let entry of this) {
			entry.free();
		}
		return this;

	}

	// ## readBytes(offset, length)
	// Returns a buffer contain the bytes starting at offset and with the 
	// given length. We use this method so that we can use a buffer or a file 
	// as underlying source interchangeably.
	readBytes(offset, length) {

		// If the buffer was loaded in memory, then it will be fastest to read 
		// from memory of course.
		if (this.buffer) {
			return this.buffer.subarray(offset, offset+length);
		}

		// If we don't have a buffer, but we do have a file path, then we read 
		// that specific part.
		if (this.file) {
			let buffer = Buffer.allocUnsafe(length);
			let fd = fs.openSync(this.file);
			fs.readSync(fd, buffer, 0, length, offset);
			fs.closeSync(fd);
			return buffer;
		}

		// No file or buffer set? Then we can't read.
		throw new Error(`DBPF file has no buffer, neither file set.`);

	}

	// ## readBytesAsync(offset, length)
	// Same as readBytes, but in an async way. You normally shouldn't use this 
	// for modding tasks, but we use it for reading in large plugin folders in 
	// parallel.
	async readBytesAsync(offset, length) {
		if (this.buffer) return this.buffer.subarray(offset, offset+length);
		else if (this.file) {
			let buffer = Buffer.allocUnsafe(length);
			let fh = await fs.promises.open(this.file);
			await fh.read(buffer, 0, length, offset);
			await fh.close();
			return buffer;
		}
		throw new Error(`DBPF file has no buffer, neither file set.`);
	}

	// ## parse()
	// Reads in the DBPF in a *synchronous* way. That's useful if you're 
	// testing stuff out, but for bulk reading you should use the async 
	// reading.
	parse() {
		const dirs = fn => this.findAll({ type: FileType.DIR }).map(entry => {
			fn(entry.read());
		});
		return parse.sync.call(
			this,
			(...args) => this.readBytes(...args),
			dirs,
		);
	}

	// ## parseAsync()
	// Same as parse, but in an async way.
	async parseAsync() {
		const dirs = async fn => await Promise.all(
			this.findAll({ type: FileType.DIR }).map(async entry => {
				fn(await entry.readAsync());
			}),
		);
		return await parse.async.call(
			this,
			(...args) => this.readBytesAsync(...args),
			dirs,
		);
	}

	// ## save(opts)
	// Saves the DBPF to a file. Note: we're going to do this in a sync way, 
	// it's just easier.
	save(opts) {
		if (typeof opts === 'string') {
			opts = { file: opts };
		}
		this.header.modified = new Date();
		let buff = this.toBuffer(opts);
		return fs.writeFileSync(opts.file, buff);
		// return fs.promises.writeFile(opts.file, buff);
	}

	// ## toBuffer(opts)
	// Serializes the DBPF to a buffer. Note that we can't use a streamed api 
	// here because the location of the index is dependent on the size of all 
	// entries, but the location of the index is written in the header. Hence 
	// not possible.
	toBuffer(opts) {

		// Generate the header buffer.
		let header = this.header.toBuffer();
		let chunks = [header];

		// Prepare a list of stuff that needs to be serialized along with its 
		// info, along with the list of compressed entries - the DIR file.
		let list = [];
		let dir = new DIR();
		let major = this.header.indexMajor;
		let minor = this.header.indexMinor;

		// Now serialize all entries.
		for (let entry of this.entries) {

			// If this entry is the "DIR" entry, skip it because we're going 
			// to serialize that one ourselves.
			if (entry.type === FileType.DIR) continue;

			// If the entry was already read, it means it might have been 
			// modified, so we can't reuse the raw - potentially uncompressed - 
			// buffer in any case.
			let tgi = {
				type: entry.type,
				group: entry.group,
				instance: entry.instance,
			};
			if (entry.isTouched) {
				let buffer = entry.toBuffer();
				let fileSize = buffer.byteLength;
				if (entry.compressed) {
					buffer = compress(buffer, { includeSize: true });
					dir.push({ ...tgi, size: fileSize });
				}
				list.push({
					...tgi,
					buffer,
					compressed: entry.compressed,
					fileSize,
					compressedSize: buffer.byteLength,
				});
			} else {

				// If the entry has never been read, we just reuse it as is.
				let raw = entry.readRaw();
				if (entry.compressed) {
					dir.push({ ...tgi, size: entry.fileSize });
				}
				list.push({
					...tgi,
					buffer: raw,
					compressed: entry.compressed,
					fileSize: entry.fileSize,
					compressedSize: entry.compressedSize,
				});

			}

		}

		// Ok, everything is preprocessed. Now serialize a dir entry if 
		// required.
		if (dir.length > 0) {
			let buffer = dir.toBuffer({ major, minor });
			list.push({
				type: 0xE86B1EEF,
				group: 0xE86B1EEF,
				instance: 0x286B1F03,
				buffer,
				compressed: false,
				fileSize: buffer.byteLength,
				compressedSize: buffer.byteLength,
			});

		}

		// Allright, now create all entries. We'll add them right after the 
		// header.
		let offset = header.length;
		let table = new WriteBuffer({ size: 20*list.length });
		for (let entry of list) {
			let buffer = entry.buffer;
			chunks.push(buffer);
			table.uint32(entry.type);
			table.uint32(entry.group);
			table.uint32(entry.instance);
			table.uint32(offset);
			table.uint32(buffer.byteLength);

			// Update offsets.
			offset += buffer.byteLength;

		}

		// Now add the indexTable buffer as well & write its position & count 
		// into the header.
		let tableBuffer = table.toBuffer();
		chunks.push(tableBuffer);
		header.writeUInt32LE(list.length, 36);
		header.writeUInt32LE(offset, 40);
		header.writeUInt32LE(tableBuffer.byteLength, 44);

		// Concatenate everything and report.
		return Buffer.concat(chunks);

	}

	// ## get exemplars()
	get exemplars() {
		return this.entries.filter(entry => entry.type === FileType.Exemplar);
	}

	// ## readExemplars()
	// Returns a **computed** list of all exemplar entries in the dbpf.
	readExemplars() {
		return this.exemplars.map(entry => entry.read());
	}

	// ## recordCount()
	// Returns an object that lists how many records are counted per sub file.
	recordCount() {
		let list = [];
		for (let entry of this) {
			let buff = entry.decompress();
			let size = buff.readUInt32LE();

			// Skip the entries that don't seem to hold size crc mem records.
			if (size > buff.byteLength) {
				continue;
			}
			let slice = buff.slice(0, size);
			let crc = crc32(slice, 8);
			if (crc !== buff.readUInt32LE(4)) {
				continue;
			}

			// Okay, count records now.
			let i = 0;
			while (buff.length > 4) {
				i++;
				let size = buff.readUInt32LE(0);
				buff = buff.slice(size);
			}
			if (buff.length > 0) {
				console.log('size mismatch');
			}
			list.push([cClass[entry.type], i]);

		}
		return list;
	}

	// ## memRefs()
	// Returns a list of all records (could be sub-records) in the dbpf that 
	// use a memory reference (i.e. have general structure SIZE CRC MEM). 
	// We're using the CRC to detect if this kind of entry works this way.
	memRefs() {
		let all = [];
		for (let entry of this) {
			let buff = entry.decompress();
			let size = buff.readUInt32LE();

			// If what we're interpreting as size is larger than the buffer, 
			// it's impossible that this has the structure "SIZE CRC MEM"!
			if (size > buff.byteLength) continue;

			// Note that there may be multiple records in this buffer. We're 
			// going to parse them one by one and calculate the checksum. If 
			// the checksum matches, we're considering them to have the 
			// structure "SIZE CRC MEM".
			let slice = buff.slice(0, size);
			let crc = crc32(slice, 8);
			if (crc !== buff.readUInt32LE(4)) continue;

			// Allright, first entry is of type "SIZE MEM CRC", we assume that 
			// all following entries are as well.
			all.push({
				mem: slice.readUInt32LE(8),
				type: entry.type,
				entry,
				index: 0,
			});
			let index = size;
			buff = buff.slice(size);
			while (buff.length > 4) {
				let size = buff.readUInt32LE(0);
				let slice = buff.slice(0, size);
				let mem = slice.readUInt32LE(8);
				all.push({
					mem,
					type: entry.type,
					entry,
					index,
				});
				index += size;
				buff = buff.slice(size);
			}

		}
		return all;
	}

	// ## memSearch(refs)
	// Searches all entries for a reference to the given memory address.
	memSearch(refs) {
		let original = refs;
		if (!Array.isArray(refs)) {
			refs = [refs];
		}

		// Create a buffer that we'll use to convert numbers to hex.
		let out = new Array(refs.length);
		let strings = new Array(refs.length);
		let help = Buffer.alloc(4);
		for (let i = 0; i < out.length; i++) {
			out[i] = [];
			let ref = refs[i];
			help.writeUInt32LE(ref);
			strings[i] = help.toString('hex');
		}

		// Loop all entries as outer loop. This way we only have to calculate 
		// the hex string once. Speeds things up a little.
		for (let entry of this) {
			let raw = entry.decompress().toString('hex');
			for (let i = 0; i < refs.length; i++) {
				let hex = strings[i];
				let index = raw.indexOf(hex);
				if (index > -1) {
					out[i].push({
						class: cClass[entry.type],
						entry,
						index,
					});
				}
			}
		}

		return !Array.isArray(original) ? out[0] : out;
		
	}

	// ## *[Symbol.iterator]
	// Allow iterating over the dbpf file by looping all it's entries.
	*[Symbol.iterator]() {
		yield* this.entries;
	}

	// ## static register(Constructor)
	// It should be possible to register new file types on the fly so that 
	// people can write plugins for certain unknown filetypes. This can be 
	// done by calling DBPF.register(Ctor). Subsequently if entry.read() 
	// is called, the type id might be recognized and hence parsed accordingly.
	static register(Constructor) {
		register(Constructor);
	}

}

// # parse()
// Parsing a DBPF can be done both in a sync and async way, but the underlying 
// logic is the same.
const parse = duplicateAsync(function* parse(read, readDirs) {

	// First of all we need to read the header, and only the header. From 
	// this we can derive where to find the index so that we can parse the 
	// entries from it.
	let header = this.header = new Header();
	header.parse(new Stream(this.readBytes(0, 96)));

	// Header is parsed which means we now know the offset of the index. 
	// Read in the bytes of the index and then build up the index.
	let index = yield read(header.indexOffset, header.indexSize);
	fillIndex(this, index);

	// We're not done yet. The last thing we need to do is read in all the 
	// DIR files to mark which entries in the DBPF are compressed.
	yield readDirs(dir => handleDir(this, dir));
	return this;

});

// # fillIndex(dbpf, buffer)
// Reads & parses the buffer containing the file index.
function fillIndex(dbpf, buffer) {
	let rs = new Stream(buffer);
	let index = dbpf.entries = new TGIIndex(dbpf.header.indexCount);
	for (let i = 0; i < index.length; i++) {
		let entry = index[i] = new Entry(dbpf);
		entry.parse(rs);
	}
	index.build();
}

// # handleDir(dbpf, dir)
// Handles the given dir file and marks the entries in it as compressed
function handleDir(dbpf, dir) {
	let index = dbpf.entries;
	for (let { type, group, instance, size } of dir) {
		let entry = index.find(type, group, instance);
		if (!entry) continue;
		entry.compressed = true;
		entry.fileSize = size;
	}
}
