// # dbpf-header.js
import { SmartBuffer } from 'smart-arraybuffer';
import Version from './version.js';

export type HeaderOptions = {
	id?: string;
	version?: string;
	created?: Date | string | number;
	modified?: Date | string | number;
	indexMajor?: number;
	indexMinor?: number;
	indexCount?: number;
	indexOffset?: number;
	indexSize?: number;
};
export type HeaderJSON = Required<HeaderOptions>;

// # Header
export default class Header {
	buffer: Uint8Array;

	// ## constructor(opts)
	constructor(opts?: Uint8Array | HeaderOptions) {
		if (opts instanceof Uint8Array) {
			this.buffer = opts;
		} else {
			this.buffer = getDefaultHeader(opts);
		}
	}

	// ## get #reader()
	get #reader() {
		return SmartBuffer.fromBuffer(this.buffer);
	}
	get #writer() {
		return SmartBuffer.fromBuffer(this.buffer);
	}

	// ## get id()
	get id(): string {
		return this.#reader.readString(4);
	}

	// ## get version()
	get version(): string {
		const rs = this.#reader;
		const major = rs.readUInt32LE(4);
		const minor = rs.readUInt32LE(8);
		return [major, minor].join('.');
	}
	get created() { return new Date(1000*this.#reader.readUInt32LE(24)); }
	set created(value: Date | string | number) {
		this.#writer.writeUInt32LE(toUnixTimestamp(value), 24);
	}
	get modified() { return new Date(1000*this.#reader.readUInt32LE(28)); }
	set modified(value: Date | string | number) {
		this.#writer.writeUInt32LE(toUnixTimestamp(value), 28);
	}
	get indexMajor() { return this.#reader.readUInt32LE(32); }
	get indexMinor() { return this.#reader.readUInt32LE(60); }
	get indexCount() { return this.#reader.readUInt32LE(36); }
	get indexOffset() { return this.#reader.readUInt32LE(40); }
	get indexSize() { return this.#reader.readUInt32LE(44); }

	// ## toBuffer()
	toBuffer() { return this.buffer; }

	// ## toJSON()
	toJSON() {
		const {
			version,
			created,
			modified,
			indexMajor,
			indexMinor,
			indexCount,
			indexOffset,
			indexSize,
		} = this;
		return {
			version,
			created,
			modified,
			indexMajor,
			indexMinor,
			indexCount,
			indexOffset,
			indexSize,
		};
	}

	[Symbol.for('nodejs.util.inspect.custom')]() {
		return this.toJSON();
	}

}

// # getDefaultHeader(opts)
function getDefaultHeader(opts: HeaderOptions = {}) {
	const {
		version = '1.0',
		created = Date.now(),
		modified = Date.now(),
		indexMajor = 7,
		indexMinor = 0,
		indexCount = 0,
		indexOffset = 0,
		indexSize = 0,
	} = opts;
	const buffer = new SmartBuffer({ size: 96 });
	buffer.writeString('DBPF');
	const [major, minor] = new Version(version);
	buffer.writeUInt32LE(major);
	buffer.writeUInt32LE(minor);
	buffer.writeUInt32LE(toUnixTimestamp(created), 24);
	buffer.writeUInt32LE(toUnixTimestamp(modified), 28);
	buffer.writeUInt32LE(indexMajor, 32);
	buffer.writeUInt32LE(indexCount, 36);
	buffer.writeUInt32LE(indexOffset, 40);
	buffer.writeUInt32LE(indexSize, 44);
	buffer.writeUInt32LE(indexMinor, 60);
	return buffer.internalUint8Array;
}

// # toUnixTimestamp(date)
function toUnixTimestamp(date: Date | number | string): number {
	if (typeof date === 'number') return date / 1000;
	else if (typeof date === 'string') return Date.parse(date) / 1000;
	else return date.getTime() / 1000;
}
