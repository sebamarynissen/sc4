// # com-serializer-file.js
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';

// # COMSerializerFile
export default class COMSerializerFile {
	static [kFileType] = FileType.COMSerializer;
	u1 = 0x00000001;
	u2 = 0x00000000;
	index: Map<number, number> = new Map();

	// ## get(type)
	// Returns the amount of serialized objects of the given type.
	get(type: number) {
		return this.index.get(type);
	}

	// ## set(type, count)
	// Sets the amount of serialized objects of the given type.
	set(type: number, count: number) {
		this.index.set(type, count);
		return this;
	}

	// ## update(type, array)
	// Updates the amount of serialized objects for the given array. Makes it 
	// easier than having to user `set(type, count)` all the time.
	update(type: number, array: any[]) {
		this.set(type, array.length);
		return this;
	}

	// ## parse(buff)
	// Parses the COMSerializerfile from the given buffer.
	parse(streamOrBuffer: Stream | Uint8Array) {

		// Is this the version number. Don't know. Always seems to be 1.
		let rs = new Stream(streamOrBuffer);
		this.u1 = rs.dword();
		let count = rs.dword();
		this.u2 = rs.dword();

		// Clear index.
		const { index } = this;
		index.clear();

		// Read all props.
		for (let i = 0; i < count; i++) {
			let type = rs.dword();
			let count = rs.dword();
			index.set(type, count);
		}

		// Done!
		return this;

	}

	// ## toBuffer()
	toBuffer() {

		// Prepare the entire buffer.
		let index = this.index;
		let ws = new WriteBuffer();

		// Write away.
		ws.dword(this.u1);
		ws.dword(this.index.size);
		ws.dword(this.u2);

		// Note: we need to write away everything in sorted order - don't know 
		// if it's a hard requirement, but DBPF always seems to do it like 
		// this. Hence we'll need to sort first.
		let all = Array.from(index);
		all.sort((a, b) => a[0] - b[0]);
		for (let [type, count] of all) {
			ws.dword(type);
			ws.dword(count);
		}
		return ws.toUint8Array();

	}

}
