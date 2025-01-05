import type { dword, float, word } from 'sc4/types';
import FileType from './file-types.js';
import type Stream from './stream.js';
import { kFileType } from './symbols.js';
import Unknown from './unknown.js';

// # terrain-box.ts
export default class TerrainBox {
	static [kFileType] = FileType.TerrainBox;
	major: word = 0x0002;
	xSize: dword = 0x065;
	zSize: dword = 0x065;
	minY: float = 0;
	maxY: float = 0;
	unknown = new Unknown()
		.dword(0x00000000)
		.float(308);

	// # parse(rs)
	parse(rs: Stream) {
		this.unknown = new Unknown();
		let unknown = this.unknown.reader(rs);
		this.major = rs.word();
		this.xSize = rs.dword();
		this.zSize = rs.dword();
		unknown.dword();
		this.minY = rs.float();
		this.maxY = rs.float();
		unknown.float();
		rs.assert();
	}

}
