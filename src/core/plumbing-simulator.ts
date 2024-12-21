// # plumbing-simulator.js
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import Pointer from './pointer.js';
import Unknown from './unknown.js';
import { kFileType } from './symbols.js';
import type { byte, dword } from 'sc4/types';
import type { SimGridUint8 } from './sim-grid-file.js';
import type Pipe from './pipe.js';
import type DepartmentBudget from './department-budget.js';

type Building = {
	xAnchor: dword;
	zAnchor: dword;
	xMin: dword;
	zMin: dword;
	xMax: dword;
	zMax: dword;
	capacity: dword;
	actualCapacity: dword;
	pointer: Pointer;
};

// # PlumbingSimulator
// The class that is used for the plumbing simulator.
export default class PlumbingSimulator {
	static [kFileType] = FileType.PlumbingSimulator;
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0004;
	grid1: Pointer<SimGridUint8> = new Pointer(FileType.SimGridUint8);
	grid2: Pointer<SimGridUint8> = new Pointer(FileType.SimGridUint8);
	xSize = 0x00000040;
	zSize = 0x00000040;
	cells: byte[][] = [];
	revision = 0x00000000;
	buildings: Building[] = [];
	citySize = 0x00000040;
	xTiles = 0x0000003f;
	zTiles = 0x0000003f;
	filterCapacity = 0x00000000;
	pipes: Pointer<Pipe>[] = [];
	departmentBudget: Pointer<DepartmentBudget> = new Pointer(FileType.DepartmentBudget);
	totalProduced = 0x00000000;
	actualFilterCapacity = 0x00000000;
	u = new Unknown()
		.repeat(3, u => u.dword(0x00000000))
		.dword(0x00000000)
		.repeat(9, u => u.dword(0x00000000))
		.byte(0x02)
		.dword(0x00000000)
		.dword(0x00000001)
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x00000000)
		.repeat(5, u => u.dword(0x00000000));

	// ## clear()
	// Will clear all entries in the plumbing simulator.
	clear() {
		for (let row of this.cells) {
			row.fill(0);
		}
		this.buildings = [];
		this.pipes = [];
	}

	// ## parse(buff)
	parse(buff: Stream | Uint8Array) {
		const rs = new Stream(buff);
		const unkown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.grid1 = rs.pointer()!;
		this.grid2 = rs.pointer()!;
		this.xSize = rs.dword();
		this.zSize = rs.dword();
		let cells = this.cells = new Array(this.zSize);
		for (let z = 0; z < this.zSize; z++) {
			let row = cells[z] = new Array(this.xSize);
			for (let x = 0; x < this.xSize; x++) {
				row[x] = rs.byte();
			}
		}
		this.revision = rs.dword();
		unkown.repeat(3, u => u.dword());
		let buildings = this.buildings = new Array(rs.dword());
		unkown.dword();
		for (let i = 0; i < buildings.length; i++) {
			buildings[i] = {
				xAnchor: rs.dword(),
				zAnchor: rs.dword(),
				xMin: rs.dword(),
				zMin: rs.dword(),
				xMax: rs.dword(),
				zMax: rs.dword(),
				capacity: rs.dword(),
				actualCapacity: rs.dword(),
				pointer: rs.pointer(),
			};
		}
		unkown.repeat(9, u => u.dword());
		unkown.byte();
		unkown.dword();
		this.citySize = rs.dword();
		unkown.dword();
		unkown.dword();
		unkown.dword();
		this.xTiles = rs.dword();
		this.zTiles = rs.dword();
		this.filterCapacity = rs.dword();
		unkown.dword();
		let pipes = this.pipes = new Array<Pointer<Pipe>>(rs.dword());
		unkown.dword();
		unkown.dword();
		for (let i = 0; i < this.pipes.length; i++) {
			pipes[i] = rs.pointer()!;
		}
		this.departmentBudget = rs.pointer()!;
		this.totalProduced = rs.dword();
		unkown.dword();
		this.actualFilterCapacity = rs.dword();
		unkown.repeat(5, u => u.dword());
		rs.assert();
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		let unknown = this.u.writer(ws);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.pointer(this.grid1);
		ws.pointer(this.grid2);
		ws.dword(this.xSize);
		ws.dword(this.zSize);
		for (let x = 0; x < this.xSize; x++) {
			let column = this.cells[x];
			for (let z = 0; z < this.zSize; z++) {
				ws.byte(column[z]);
			}
		}
		ws.dword(this.revision);
		unknown.repeat(3, u => u.dword());
		ws.dword(this.buildings.length);
		unknown.dword();
		for (let building of this.buildings) {
			ws.dword(building.xAnchor);
			ws.dword(building.zAnchor);
			ws.dword(building.xMin);
			ws.dword(building.zMin);
			ws.dword(building.xMax);
			ws.dword(building.zMax);
			ws.dword(building.capacity);
			ws.dword(building.actualCapacity);
			ws.pointer(building.pointer);
		}
		unknown.repeat(9, u => u.dword());
		unknown.byte();
		unknown.dword();
		ws.dword(this.citySize);
		unknown.dword();
		unknown.dword();
		unknown.dword();
		ws.dword(this.xTiles);
		ws.dword(this.zTiles);
		ws.dword(this.filterCapacity);
		unknown.dword();
		ws.dword(this.pipes.length);
		unknown.dword();
		unknown.dword();
		for (let ptr of this.pipes) {
			ws.pointer(ptr);
		}
		ws.pointer(this.departmentBudget);
		ws.dword(this.totalProduced);
		unknown.dword();
		ws.dword(this.actualFilterCapacity);
		unknown.repeat(5, u => u.dword());
		return ws.seal();
	}

}
