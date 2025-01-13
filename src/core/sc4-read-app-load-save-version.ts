// # sc4-read-app-load-save-version.ts
import type { dword } from 'sc4/types';
import FileType from './file-types.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import WriteBuffer from './write-buffer.js';

export default class SC4ReadAppLoadSaveVersion {
	static [kFileType] = FileType.CityPointer;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	unknown: dword = 0x00000000;
	version: dword = 0x00000003;
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.unknown = rs.dword();
		this.version = rs.dword();
		rs.assert();
	}
	toBuffer() {
		let ws = new WriteBuffer({ size: 20 });
		ws.dword(this.mem);
		ws.dword(this.unknown);
		ws.dword(this.version);
		return ws.seal();
	}
}
