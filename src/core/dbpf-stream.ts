// # dbpf-stream.ts
import type { TGIArray, TGILiteral } from 'sc4/types';
import fs from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import TGI from './tgi.js';
import Header from './dbpf-header.js';
import { compress } from 'qfs-compression';
import DIR from './dir.js';
import WriteBuffer from './write-buffer.js';

type BufferAddOptions = {
	compressed?: boolean;
	fileSize?: number;
	compressedSize?: number;
	compress?: boolean;
};

type IndexEntry = {
	tgi: TGI;
	compressed: boolean;
	offset: number;
	compressedSize: number;
};

// A DBPFStream can be used to write a DBPF file to disk without having to load 
// all its files in memory first. This is useful when datpacking very large 
// files, as it's not feasible to load hundreds of megabytes into memory first 
// before being able to write it away.
export default class DBPFStream {
	file: string = '';
	fd: FileHandle;
	flag: string;
	byteLength = 0;
	private entries: IndexEntry[] = [];
	dir = new DIR();	
	constructor(file: string, flag: string = 'w') {
		this.file = file;
		this.flag = flag;
	}

	// ## getHandle()
	// Returns the file handle for the streaming operation. It will 
	// automatically create it when it does not exist yet and write away the 
	// provisional header already.
	private async getHandle() {
		if (this.fd) return this.fd;
		let fd = this.fd = await fs.promises.open(this.file, this.flag);
		let headerLength = 96;
		await fd.write(new Uint8Array(headerLength));
		this.byteLength = headerLength;
		return fd;
	}

	// ## add()
	// Adds a new file to the DBPF file. If the file should be compressed, 
	// specify `{ compress: true }` as options. If the file is already 
	// compressed, then specify `{ compressed: true }`.
	async add(
		tgiLike: TGILiteral | TGIArray,
		buffer: Uint8Array,
		opts: BufferAddOptions = {},
	) {

		// Check if we still have to compress. Note that we'll do this in 
		// parallel with aquiring the handle.
		let promise = this.getHandle();
		if (opts.compress) {
			buffer = compress(buffer, { includeSize: true });
		}
		let { compressed = opts.compress || false } = opts;

		// Get the file handle.
		let fh = await promise;
		let offset = this.byteLength;
		let { bytesWritten } = await fh.write(buffer);
		this.byteLength += bytesWritten;
		let {
			fileSize = (
				// Note we've prefixed the *compressed size* in the buffer, 
				// which means when reading the uncompressd size from the 
				// buffer, we have to truncate this again.
				compressed ?
					readFileSizeFromCompressedBuffer(buffer.subarray(4)) :
					bytesWritten
			),
			compressedSize = bytesWritten,
		} = opts;

		// Add this file to the entries written.
		let tgi = new TGI(tgiLike);
		let entry = {
			tgi,
			compressed,
			compressedSize,
			offset,
		};
		this.entries.push(entry);

		// If the entry was compressed, we have to store it in our DIR entry as 
		// well.
		if (entry.compressed) {
			this.dir.push({ ...tgi, size: fileSize });
		}

	}

	// ## seal()
	// Finishes the dbpf stream by writing away the file index and its location 
	// in the header.
	async seal() {

		// First of all we'll serialize the DIR entry and write it away, but 
		// only if there are any compressed entries.
		let fh = await this.getHandle();
		let hasCompressed = this.entries.some(entry => entry.compressed);
		if (hasCompressed) {
			let offset = this.byteLength;
			let buffer = this.dir.toBuffer();
			let { bytesWritten } = await fh.write(buffer)
			this.byteLength += bytesWritten;

			// Put it in our array containing all index tables entries too.
			this.entries.push({
				tgi: new TGI(0xE86B1EEF, 0xE86B1EEF, 0x286B1F03),
				compressed: false,
				compressedSize: buffer.byteLength,
				offset,
			});
		}

		// Now write away the index table as well, byt keep track of where it is 
		// stored of course.
		let indexOffset = this.byteLength;
		let table = new WriteBuffer({ size: 20*this.entries.length });
		for (let entry of this.entries) {
			table.tgi(entry.tgi);
			table.uint32(entry.offset);
			table.uint32(entry.compressedSize);
		}
		let tableBuffer = table.toUint8Array();
		let { bytesWritten } = await fh.write(tableBuffer);
		this.byteLength += bytesWritten;

		// To finish everything off, we update the header to point to the index 
		// table.
		let header = new Header({
			indexOffset,
			indexCount: this.entries.length,
			indexSize: tableBuffer.byteLength,
		}).toBuffer();
		await fh.write(header, 0, header.byteLength, 0);
		await fh.close();

	}

}

// # readFileSizeFromCompressedBuffer(buffer)
// QFS compression always stores the *uncompressed* size in byte 2, 3 and 4, so 
// we can read it from there. Interestingly, it's stored as BE.
function readFileSizeFromCompressedBuffer(buffer: Uint8Array) {
	return 0x10000*buffer[2] + 0x100*buffer[3] + buffer[4];
}