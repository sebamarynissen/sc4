import type { dword, word } from 'sc4/types';
import FileType from './file-types.js';
import { kFileType } from './symbols.js';
import Unknown from './unknown.js';
import Stream from './stream.js';
import type Pointer from './pointer.js';
import WriteBuffer from './write-buffer.js';
import { SmartBuffer } from 'smart-arraybuffer';
import { cClass } from './enums.js';

function readBackwards(buffer: Uint8Array) {

	// As long as we encounter pointers, keep on going.
	let count = 0;
	let offset = buffer.byteLength-4;
	let reader = SmartBuffer.fromBuffer(buffer);
	let pointer = reader.readUInt32LE(offset);
	while (pointer !== 0 && String(pointer) in cClass) {
		offset -= 8;
		count++;
		pointer = reader.readUInt32LE(offset);
	}
	if (reader.readUInt32LE(offset) !== count) {
		throw new Error('This is not a pointer array');
	}
	let slice = buffer.subarray(0, offset);
	let rs = new Stream(buffer.subarray(offset));
	let pointers = rs.array(() => rs.pointer()!);
	return { slice, pointers };

}

function format(buffer: Uint8Array) {
	return [...buffer].map(x => x.toString(16).padStart(2, '0')).join(' ');
}

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
	adviceArray: dword[];
	array1: Pointer[];
	array2: Pointer[];
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
		let header = rs.read(17);

		// Next we'll do something fancy. We don't really know the structure 
		// yet, of what follows, but we *do* know the structure at the end. 
		// Hence we'll consume the buffer *from the back*.
		let slice = rs.read(rs.remaining()-5);
		({ slice } = readBackwards(slice));
		({ slice } = readBackwards(slice));
		({ slice } = readBackwards(slice));
		({ slice } = readBackwards(slice));
		let rest = slice;

		// unknown.dword();
		// unknown.dword();
		// unknown.byte();
		// this.array1 = rs.array(() => rs.pointer()!);
		// if (this.count1 > 0) {
		// 	this.array2 = rs.array(() => rs.pointer()!);
		// } else {
		// 	this.array2 = [];
		// }
		// rs.array(() => rs.dword());
		// this.array3 = rs.array(() => rs.pointer()!);
		// this.array4 = rs.array(() => rs.pointer()!);
		// this.array5 = rs.array(() => rs.pointer()!);
		// this.array6 = rs.array(() => rs.pointer()!);
		// unknown.dword();
		// unknown.byte();
		// rs.assert();
		// let rest = rs.read();
		let postfix = rest.length > 64 ? '...' : '   ';
		console.log(
			String(this.count1).padEnd(8, ' '),
			format(header),
			postfix,
			format(rest.subarray(-64)),
		);
		return this;
	}
	toBuffer() {
		let ws = new WriteBuffer();
		let unknown = this.u.writer(ws);
		ws.dword(this.mem);
		ws.word(this.major);
		unknown.bytes();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.dword();
		unknown.byte();
		unknown.dword();
		ws.pointer(this.wealthRequester);
		ws.pointer(this.crimeSimulator);
		ws.pointer(this.pollutionSimulator);
		ws.pointer(this.zoneDeveloper);
		ws.pointer(this.propManager);
		ws.pointer(this.networkLotManager);
		ws.dword(this.count1);
		if (this.count1 > 0) {
			unknown.dword();
		}
		unknown.dword();
		unknown.dword();
		unknown.byte();
		ws.array(this.array1, x => ws.pointer(x));
		ws.array(this.adviceArray, x => ws.dword(x));
		ws.array(this.array3, x => ws.pointer(x));
		ws.array(this.array4, x => ws.pointer(x));
		ws.array(this.array5, x => ws.pointer(x));
		ws.array(this.array6, x => ws.pointer(x));
		unknown.dword();
		unknown.byte();
		return ws.seal();
	}
}
