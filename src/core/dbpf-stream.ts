// # dbpf-stream.ts
import type { TGIArray, TGILiteral } from 'sc4/types';
import fs from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import TGI from './tgi.js';
import Header from './dbpf-header.js';
import { compress } from 'qfs-compression';
import DIR from './dir.js';
import WriteBuffer from './write-buffer.js';
import FileType from './file-types.js';
import type DBPF from './dbpf.js';
import { getCompressionInfo } from 'sc4/utils';

type BufferAddOptions = {
	compress?: boolean;
};

type IndexEntry = {
	tgi: TGI;
	offset: number;
	size: number;
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
		let info: ReturnType<typeof getCompressionInfo>;
		if (opts.compress) {
			let size = buffer.byteLength;
			buffer = compress(buffer, { includeSize: true });
			info = { compressed: true, size };
		} else {
			info = getCompressionInfo(buffer);
		}

		// Get the file handle.
		let fh = await promise;
		let offset = this.byteLength;
		let { bytesWritten } = await fh.write(buffer);
		this.byteLength += bytesWritten;

		// Add this file to the entries written.
		let tgi = new TGI(tgiLike);
		let entry = {
			tgi,
			offset,
			size: bytesWritten,
		};
		this.entries.push(entry);

		// If the entry was compressed, we have to store it in our DIR entry as 
		// well.
		if (info.compressed) {
			this.dir.push({ tgi, size: info.size });
		}

	}

	// ## addDbpf(dbpf)
	// Adds an entire dbpf to the stream - also known as datpacking. Note that 
	// the dbpf should already have been parsed!
	async addDbpf(dbpf: DBPF) {
		for (let entry of dbpf) {

			// Obviously DIR files don't need to be copied
			if (entry.type === FileType.DIR) continue;

			// Don't parse or decompress the entry. We'll just keep it as is: a 
			// potentially compressed buffer read from the filesystem.
			let buffer = await entry.readRawAsync();
			await this.add(entry.tgi, buffer);

		}
	}

	// ## seal()
	// Finishes the dbpf stream by writing away the file index and its location 
	// in the header.
	async seal() {

		// First of all we'll serialize the DIR entry and write it away, but 
		// only if there are any compressed entries.
		let fh = await this.getHandle();
		if (this.dir.length > 0) {
			let offset = this.byteLength;
			let buffer = this.dir.toBuffer();
			let { bytesWritten } = await fh.write(buffer)
			this.byteLength += bytesWritten;

			// Put it in our array containing all index tables entries too.
			this.entries.push({
				tgi: new TGI(0xE86B1EEF, 0xE86B1EEF, 0x286B1F03),
				offset,
				size: bytesWritten,
			});
		}

		// Now write away the index table as well, byt keep track of where it is 
		// stored of course.
		let indexOffset = this.byteLength;
		let table = new WriteBuffer({ size: 20*this.entries.length });
		for (let entry of this.entries) {
			table.tgi(entry.tgi);
			table.uint32(entry.offset);
			table.uint32(entry.size);
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
