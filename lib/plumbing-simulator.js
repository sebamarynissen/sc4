// # plumbing-simulator.js
'use strict';
const Stream = require('./stream.js');
const WriteBuffer = require('./write-buffer.js');
const { FileType } = require('./enums.js');
const Pointer = require('./pointer.js');
const Unknown = require('./unknown.js');

// # PlumbingSimulator
// The class that is used for the plumbing simulator.
class PlumbingSimulator {

	static [Symbol.for('sc4.type')] = FileType.PlumbingSimulator;

	// # constructor(opts)
	constructor(opts) {
		new Unknown(this);
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0004;
		this.grid1 = new Pointer(FileType.SimGridUint8);
		this.grid2 = new Pointer(FileType.SimGridUint8);
		this.xSize = 0x00000040;
		this.zSize = 0x00000040;
		this.cells = [];
		this.revision = 0x00000000;
		repeat(3, () => this.unknown.dword(0x00000000));
		this.unknown.dword(0x00000000);
		this.buildings = [];
		repeat(9, () => this.unknown.dword(0x00000000));
		this.unknown.byte(0x02);
		this.unknown.dword(0x00000000);
		this.citySize = 0x00000040;
		this.unknown.dword(0x00000001);
		this.unknown.dword(0x00000000);
		this.unknown.dword(0x00000000);
		this.xTiles = 0x0000003f;
		this.zTiles = 0x0000003f;
		this.filterCapacity = 0x00000000;
		this.unknown.dword(0x00000000);
		this.pipes = [];
		this.unknown.dword(0x00000000);
		this.unknown.dword(0x00000000);
		this.departmentBudget = new Pointer(FileType.DepartmentBudget);
		this.totalProduced = 0x00000000;
		this.unknown.dword(0x00000000);
		this.actualFilterCapacity = 0x00000000;
		repeat(5, () => this.unknown.dword(0x00000000));
	}

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
	parse(buff) {
		new Unknown(this);
		const rs = new Stream(buff);
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.grid1 = rs.pointer();
		this.grid2 = rs.pointer();
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
		repeat(3, () => this.unknown.dword(rs.dword()));
		let buildings = this.buildings = new Array(rs.dword());
		this.unknown.dword(rs.dword());
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
		repeat(9, () => this.unknown.dword(rs.dword()));
		this.unknown.byte(rs.byte());
		this.unknown.dword(rs.dword());
		this.citySize = rs.dword();
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		this.xTiles = rs.dword();
		this.zTiles = rs.dword();
		this.filterCapacity = rs.dword();
		this.unknown.dword(rs.dword());
		let pipes = this.pipes = new Array(rs.dword());
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		for (let i = 0; i < this.pipes.length; i++) {
			pipes[i] = rs.pointer();
		}
		this.departmentBudget = rs.pointer();
		this.totalProduced = rs.dword();
		this.unknown.dword(rs.dword());
		this.actualFilterCapacity = rs.dword();
		repeat(5, () => this.unknown.dword(rs.dword()));
		rs.assert();
	}

	// ## toBuffer()
	toBuffer() {
		let unknown = this.unknown.generator();
		let ws = new WriteBuffer();
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
		repeat(3, () => ws.dword(unknown()));
		ws.dword(this.buildings.length);
		ws.dword(unknown());
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
		repeat(9, () => ws.dword(unknown()));
		ws.byte(unknown());
		ws.dword(unknown());
		ws.dword(this.citySize);
		ws.dword(unknown());
		ws.dword(unknown());
		ws.dword(unknown());
		ws.dword(this.xTiles);
		ws.dword(this.zTiles);
		ws.dword(this.filterCapacity);
		ws.dword(unknown());
		ws.dword(this.pipes.length);
		ws.dword(unknown());
		ws.dword(unknown());
		for (let ptr of this.pipes) {
			ws.pointer(ptr);
		}
		ws.pointer(this.departmentBudget);
		ws.dword(this.totalProduced);
		ws.dword(unknown());
		ws.dword(this.actualFilterCapacity);
		repeat(5, () => ws.dword(unknown()));
		return ws.seal();
	}

}
module.exports = PlumbingSimulator;

function repeat(n, fn) {
	for (let i = 0; i < n; i++) fn();
}
