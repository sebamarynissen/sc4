import type { dword, word } from 'sc4/types';
import FileType from './file-types.js';
import { kFileType } from './symbols.js';
import Unknown from './unknown.js';
import type Stream from './stream.js';
import type Pointer from './pointer.js';

// # prop-developer.ts
export default class PropDeveloper {
	static [kFileType] = FileType.PropDeveloper;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	major: word = 0x0005;
	wealthRequester: Pointer;
	crimeSimulator: Pointer;
	pollutionSimulator: Pointer;
	zoneDeveloper: Pointer;
	propManager: Pointer;
	networkLotManager: Pointer;
	count1: number = 0;
	array1: Pointer[];
	adviceArray: dword[];
	array3: Pointer[];
	array4: Pointer[];
	array5: Pointer[];
	array6: Pointer[];
	u = new Unknown()
		.bytes([2, 1])
		.dword()
		.dword()
		.dword(1)
		.dword(0)
		.dword(0)
		.dword()
		.dword()
		.byte(1)
		.dword(3);
	parse(rs: Stream) {
		this.u = new Unknown();
		let unknown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		unknown.bytes(2);
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		this.wealthRequester = rs.pointer()!;
		this.crimeSimulator = rs.pointer()!;
		this.pollutionSimulator = rs.pointer()!;
		this.zoneDeveloper = rs.pointer()!;
		this.propManager = rs.pointer()!;
		this.networkLotManager = rs.pointer()!;
		this.count1 = rs.dword();
		if (this.count1 > 0) {
			unknown.dword();
		}
		unknown.dword();
		unknown.dword();
		unknown.byte();
		this.array1 = rs.array(() => rs.pointer()!);
		this.adviceArray = rs.array(() => rs.dword());
		this.array3 = rs.array(() => rs.pointer()!);
		this.array4 = rs.array(() => rs.pointer()!);
		this.array5 = rs.array(() => rs.pointer()!);
		this.array6 = rs.array(() => rs.pointer()!);
		unknown.dword();
		unknown.byte();
		rs.assert();
		return this;
	}
}
