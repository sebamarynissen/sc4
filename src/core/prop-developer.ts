import type { dword, word } from 'sc4/types';
import FileType from './file-types.js';
import { kFileType } from './symbols.js';
import Unknown from './unknown.js';
import Stream from './stream.js';
import type Pointer from './pointer.js';
import WriteBuffer from './write-buffer.js';

type AdviceRecord = {
	advice: dword;
	pointers: Pointer[];
};

// # prop-developer.ts
export default class PropDeveloper {
	static [kFileType] = FileType.PropDeveloper;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	major: word = 0x0005;

	// For some reason, this contains the city size in tracts (4x4 tiles), but 
	// minus. This means that it is 0x07 for small tiles, 0x0f for medium tiles 
	// and 0x1f for large tiles.
	tractSize: [dword, dword] = [0x00000007, 0x00000007];
	wealthRequester: Pointer;
	crimeSimulator: Pointer;
	pollutionSimulator: Pointer;
	zoneDeveloper: Pointer;
	propManager: Pointer;
	networkLotManager: Pointer;
	count1: number = 0;
	count2: number = 0;
	count3: number = 0;
	count4: number = 0;
	nightTimedProps: Pointer[] = [];
	array2: AdviceRecord[] = [];
	hourTimedProps: Pointer[] = [];
	dateTimedProps: Pointer[] = [];
	array5: Pointer[] = [];
	u = new Unknown()
		.bytes([2, 1])
		.dword()
		.dword()
		.dword(1)
		.dword(0)
		.dword(0)
		.byte(1)
		.dword(3)
		.byte(0)
		.dword(1)
		.byte(0);
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
		this.tractSize = [rs.dword(), rs.dword()];
		unknown.byte();
		unknown.dword();
		this.wealthRequester = rs.pointer()!;
		this.crimeSimulator = rs.pointer()!;
		this.pollutionSimulator = rs.pointer()!;
		this.zoneDeveloper = rs.pointer()!;
		this.propManager = rs.pointer()!;
		this.networkLotManager = rs.pointer()!;
		this.count1 = rs.dword();
		this.count2 = rs.dword();
		this.count3 = rs.dword();
		this.count4 = rs.dword();
		unknown.byte();
		this.nightTimedProps = rs.array(() => rs.pointer()!);
		this.array2 = rs.array(() => {
			let advice = rs.dword();
			let pointers = rs.array(() => rs.pointer()!);
			return { advice, pointers };
		});
		this.hourTimedProps = rs.array(() => rs.pointer()!);
		this.dateTimedProps = rs.array(() => rs.pointer()!);
		this.array5 = rs.array(() => rs.pointer()!);
		unknown.dword();
		unknown.byte();
		rs.assert();
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
		ws.tuple(this.tractSize, ws.dword);
		unknown.byte();
		unknown.dword();
		ws.pointer(this.wealthRequester);
		ws.pointer(this.crimeSimulator);
		ws.pointer(this.pollutionSimulator);
		ws.pointer(this.zoneDeveloper);
		ws.pointer(this.propManager);
		ws.pointer(this.networkLotManager);
		ws.dword(this.count1);
		ws.dword(this.count2);
		ws.dword(this.count3);
		ws.dword(this.count4);
		unknown.byte();
		ws.array(this.nightTimedProps, ws.pointer);
		ws.array(this.array2, record => {
			ws.dword(record.advice);
			ws.array(record.pointers, ws.pointer);
		});
		ws.array(this.hourTimedProps, ws.pointer);
		ws.array(this.dateTimedProps, ws.pointer);
		ws.array(this.array5, ws.pointer);
		unknown.dword();
		unknown.byte();
		return ws.seal();
	}

	// ## clear()
	clear() {
		this.nightTimedProps = [];
		this.array2 = [];
		this.hourTimedProps = [];
		this.dateTimedProps = [];
		this.array5 = [];
		return this;
	}

}
