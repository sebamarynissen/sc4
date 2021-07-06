// # plumbing-simulator.js
'use strict';
const Type = require('./type.js');
const Stream = require('./stream.js');
const WriteBuffer = require('./write-buffer.js');
const { FileType } = require('./enums.js');
const Pointer = require('./pointer.js');
const { chunk } = require('../lib/util.js');
const Unknown = require('./unknown.js');

// # PlumbingSimulator
// The class that is used for the plumbing simulator.
class PlumbingSimulator extends Type(FileType.PlumbingSimulator) {

	// # constructor(opts)
	constructor(opts) {
		super();
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
		this.budgetDepartment = new Pointer(FileType.BudgetDepartment);
		this.totalProduced = 0x00000000;
		this.unknown.dword(0x00000000);
		this.actualFilterCapacity = 0x00000000;
		repeat(5, () => this.unknown.dword(0x00000000));
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
		let cells = this.cells = new Array(this.xSize);
		for (let x = 0; x < this.xSize; x++) {
			let column = cells[x] = new Array(this.zSize);
			for (let z = 0; z < this.zSize; z++) {
				column[z] = rs.byte();
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
		this.budgetDepartment = rs.pointer();
		this.totalProduced = rs.dword();
		this.unknown.dword(rs.dword());
		this.actualFilterCapacity = rs.dword();
		repeat(5, () => this.unknown.dword(rs.dword()));

	}

}
module.exports = PlumbingSimulator;

function repeat(n, fn) {
	for (let i = 0; i < n; i++) fn();
}
