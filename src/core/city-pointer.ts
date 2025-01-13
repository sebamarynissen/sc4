// # city-pointer.ts
import FileType from './file-types.js';
import { kFileType } from './symbols.js';
import type Pointer from './pointer.js';
import type cSC4City from './csc4-city.js';
import type Stream from './stream.js';
import WriteBuffer from './write-buffer.js';

export default class CityPointer {
	static [kFileType] = FileType.CityPointer;
	version = '1.2';
	city: Pointer<cSC4City>;
	parse(rs: Stream) {
		this.version = rs.version(2);
		this.city = rs.pointer()!;
		rs.assert();
	}
	toBuffer() {
		let ws = new WriteBuffer({ size: 12 });
		ws.version(this.version);
		ws.pointer(this.city);
		return ws.toUint8Array();
	}
}
