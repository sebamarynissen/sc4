import type { dword, word } from 'sc4/types';
import FileType from './file-types.js';
import { kFileType } from './symbols.js';
import type Pointer from './pointer.js';
import type ItemIndex from './item-index.js';
import type ZoneDeveloper from './zone-developer.js';
import type Stream from './stream.js';
import WriteBuffer from './write-buffer.js';

// # prop-manager.ts
export default class PropManager {
	static [kFileType] = FileType.PropManager;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	major: word = 0x0001;
	itemIndex: Pointer<ItemIndex>;
	zoneDeveloper: Pointer<ZoneDeveloper>;
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.itemIndex = rs.pointer()!;
		this.zoneDeveloper = rs.pointer()!;
		rs.assert();
	}
	toBuffer() {
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.pointer(this.itemIndex);
		ws.pointer(this.zoneDeveloper);
		return ws.seal();
	}
}
