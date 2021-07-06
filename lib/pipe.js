// # pipe-tile.js
'use strict';
const { FileType } = require('./enums.js');
const Type = require('./type.js');
const Unknown = require('./unknown.js');
const WriteBuffer = require('./write-buffer.js');
const SGProp = require('./sgprop.js');
const Matrix = require('./matrix.js');
const Matrix3 = require('./matrix-3.js');
const Color = require('./color.js');
const Vertex = require('./vertex.js');

// # Pipe
// Pipe tiles are suprisingly large data structures (usually about 700 bytes). 
// Their structure mostly corresponds to the 
class Pipe extends Type(FileType.PipeFile) {

	// ## constructor(opts)
	constructor(opts) {
		super();
		new Unknown(this);
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0003;
		this.minor = 0x0003;
		this.zot = 0x0008;
		this.unknown.byte(0x04);
		this.unknown.dword(0x00000000);
		this.appearance = 0x05;
		this.unknown.dword(0xc772bf98);
		this.zMinTract = this.xMinTract = 0x00;
		this.zMaxTract = this.xMaxTract = 0x00;
		this.xTractSize = 0x0002;
		this.zTractSize = 0x0002;
		this.sgprops = [];
		this.GID = 0x00000000;
		this.TID = 0x00000000;
		this.IID = 0x00000000;
		this.unknown.byte(0x05);
		this.matrix3 = new Matrix3();
		this.x = 0;
		this.y = 0;
		this.z = 0;
		this.vertices = [
			new Vertex(),
			new Vertex(),
			new Vertex(),
			new Vertex(),
		];

		// Straight piece by default. Don't set to 0x00000000 by default or 
		// you'll likely crash the game (null pointers :o)
		this.textureId = 0x000004b00;
		this.unknown.bytes([0, 0, 0, 0, 0]);
		this.orientation = 0x00;
		this.unknown.bytes([0x02, 0, 0]);
		this.networkType = 0x04;
		this.westConnection = 0x00;
		this.northConnection = 0x00;
		this.eastConnection = 0x00;
		this.southConnection = 0x00;
		this.unknown.dword(0x00000000);
		this.xMin = 0;
		this.xMax = 0;
		this.yMin = 0;
		this.yMax = 0;
		this.zMin = 0;
		this.zMax = 0;
		this.unknown.bytes([0x10, 0x00, 0x00]);
		this.unknown.byte(0x10);
		repeat(4, () => this.unknown.dword(0x00000000));
		this.unknown.dword(0x00000001);
		this.unknown.dword(0x00000000);
		this.unknown.word(0x0000);
		this.unknown.float(1);
		this.blocks = 0x00000000;

		// Underground networks always need to show textures on their sides as 
		// well. There are 5 sides, respectively west, north, east, south and 
		// bottom.
		this.sideTextures = new SideTextures();
		this.unknown.dword(0x00000000);
		this.matrix = new Matrix();
		this.xTile = 0;
		this.zTile = 0;
		this.diagonalFlipped = false;
		this.sideFlag1 = true;
		this.sideFlag2 = true;
		this.yNW = 0;
		this.ySW = 0;
		this.ySE = 0;
		this.yNE = 0;
		this.yModel = 0;
		this.subfileId = 0x49c05b9f;
		this.unknown.dword(0x00000000);
		this.unknown.dword(0x00000001);
		Object.assign(this, opts);

	}

	// ## parse(rs)
	parse(rs) {
		let size = rs.dword();
		new Unknown(this);
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		this.unknown.byte(rs.byte());
		this.unknown.dword(rs.dword());
		this.appearance = rs.byte();
		this.unknown.dword(rs.dword());
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();
		this.sgprops = rs.array(rs => new SGProp().parse(rs));
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		this.unknown.byte(rs.byte());
		this.matrix3 = rs.struct(Matrix3);
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();
		this.vertices = [
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
		];

		// Time to read in the texture. Known values:
		//  - 0x00004b00: straight piece
		//  - 0x00000300: end piece
		//  - 0x00020700: X piece
		//  - 0x00005700: T piece
		//  - 0x00000100: two-side end piece
		this.textureId = rs.dword();
		this.unknown.bytes(rs.read(5));
		this.orientation = rs.byte();
		this.unknown.bytes(rs.read(3));
		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();
		this.unknown.dword(rs.dword());
		this.xMin = rs.float();
		this.xMax = rs.float();
		this.yMin = rs.float();
		this.yMax = rs.float();
		this.zMin = rs.float();
		this.zMax = rs.float();
		this.unknown.bytes(rs.read(3));
		this.unknown.byte(rs.byte());
		repeat(4, () => this.unknown.dword(rs.dword()));
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		this.unknown.word(rs.word());
		this.unknown.float(rs.float());
		this.blocks = rs.dword();
		this.sideTextures = new SideTextures().parse(rs);
		this.unknown.dword(rs.dword());
		this.matrix = rs.struct(Matrix);
		this.xTile = rs.dword();
		this.zTile = rs.dword();
		this.diagonalFlipped = rs.bool();
		this.sideFlag1 = rs.bool();
		this.sideFlag2 = rs.bool();

		// It's only here that the structure starts to differ from the network 
		// subfile records.
		this.yNW = rs.float();
		this.ySW = rs.float();
		this.ySE = rs.float();
		this.yNE = rs.float();
		this.yModel = rs.float();
		this.subfileId = rs.dword();
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		rs.assert();

	}

	// ## toBuffer()
	toBuffer() {
		const ws = new WriteBuffer();
		const unknown = this.unknown.generator();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		ws.byte(unknown());
		ws.dword(unknown());
		ws.byte(this.appearance);
		ws.dword(unknown());
		ws.byte(this.xMinTract);
		ws.byte(this.zMinTract);
		ws.byte(this.xMaxTract);
		ws.byte(this.zMaxTract);
		ws.word(this.xTractSize);
		ws.word(this.zTractSize);
		ws.array(this.sgprops);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		ws.byte(unknown());
		ws.write(this.matrix3);
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		this.vertices.forEach(v => ws.vertex(v));

		// Reading model starts below.
		ws.dword(this.textureId);
		ws.write(unknown());
		ws.byte(this.orientation);
		ws.write(unknown());
		ws.byte(this.networkType);
		ws.byte(this.westConnection);
		ws.byte(this.northConnection);
		ws.byte(this.eastConnection);
		ws.byte(this.southConnection);
		ws.dword(unknown());
		ws.float(this.xMin);
		ws.float(this.xMax);
		ws.float(this.yMin);
		ws.float(this.yMax);
		ws.float(this.zMin);
		ws.float(this.zMax);
		ws.write(unknown());
		ws.byte(unknown());
		repeat(4, () => ws.dword(unknown()));
		ws.dword(unknown());
		ws.dword(unknown());
		ws.word(unknown());
		ws.float(unknown());
		ws.dword(this.blocks);
		ws.write(this.sideTextures);
		ws.dword(unknown());
		ws.write(this.matrix);
		ws.dword(this.xTile);
		ws.dword(this.zTile);
		ws.bool(this.diagonalFlipped);
		ws.bool(this.sideFlag1);
		ws.bool(this.sideFlag2);
		ws.float(this.yNW);
		ws.float(this.ySW);
		ws.float(this.ySE);
		ws.float(this.yNE);
		ws.float(this.yModel);
		ws.dword(this.subfileId);
		ws.dword(unknown());
		ws.dword(unknown());
		return ws.seal();
	}

}
module.exports = Pipe;

// # SideTextures
// Tiny helper class for representing an array of side textures. Provides 
// west, north, east, south and bottom getters to make everything a bit more 
// readable.
class SideTextures extends Array {

	constructor() {
		super([], [], [], [], []);
	}

	get west() { return this[0]; }
	set west(value) { this[0] = value; }

	get north() { return this[1]; }
	set north(value) { this[1] = value; }

	get east() { return this[2]; }
	set east(value) { this[2] = value; }

	get south() { return this[3]; }
	set south(value) { this[3] = value; }

	get bottom() { return this[4]; }
	set bottom(value) { this[4] = value; }

	// ## vertical()
	*vertical() {
		yield this.west;
		yield this.north;
		yield this.east;
		yield this.south;
	}

	// ## parse(rs)
	parse(rs) {
		for (let i = 0; i < 5; i++) {
			this[i] = rs.array(rs => rs.vertex());
		}
		return this;
	}

	// ## write(ws)
	// Writes to the given buffer. This is a nice alternative to using 
	// toBuffer() because it doesn't require creating a new buffer for writing 
	// small stuff!
	write(ws) {
		for (let side of this) {
			ws.dword(side.length);
			for (let vertex of side) {
				ws.vertex(vertex);
			}
		}
		return ws;
	}

	// ## toBuffer()
	toBuffer() {
		return this.write(new WriteBuffer()).toBuffer();
	}

}

function repeat(n, fn) {
	for (let i = 0; i < n; i++) {
		fn();
	}
}
