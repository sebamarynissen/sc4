// # pipe-tile.js
import { FileType } from './enums.js';
import Unknown from './unknown.js';
import WriteBuffer from './write-buffer.js';
import SGProp from './sgprop.js';
import Matrix from './matrix.js';
import Matrix3 from './matrix-3.js';
import Vertex from './vertex.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type { byte, dword, float, word } from 'sc4/types';
import type Stream from './stream.js';
import type { ConstructorOptions } from 'sc4/types';

// # Pipe
// Pipe tiles are suprisingly large data structures (usually about 700 bytes). 
// Their structure mostly corresponds to the 
export default class Pipe {

	static [kFileType] = FileType.Pipe;
	static [kFileTypeArray] = true;

	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	major: word = 0x0003;
	minor: word = 0x0003;
	zot: word = 0x0008;
	appearance: byte = 0x05;
	xMinTract: byte = 0x00;
	zMinTract: byte = 0x00;
	xMaxTract: byte = 0x00;
	zMaxTract: byte = 0x00;
	xTractSize: word = 0x0002;
	zTractSize: word = 0x0002;
	sgprops: SGProp[] = [];
	GID: dword = 0x00000000;
	TID: dword = 0x00000000;
	IID: dword = 0x00000000;
	matrix3: Matrix3 = new Matrix3();
	x: float = 0;
	y: float = 0;
	z: float = 0;
	vertices: [Vertex, Vertex, Vertex, Vertex] = [
		new Vertex(),
		new Vertex(),
		new Vertex(),
		new Vertex(),
	];
	textureId: dword = 0x000004b00;
	orientation: byte = 0x00;
	networkType: byte = 0x04;
	westConnection: byte = 0x00;
	northConnection: byte = 0x00;
	eastConnection: byte = 0x00;
	southConnection: byte = 0x00;
	xMin: float = 0;
	xMax: float = 0;
	yMin: float = 0;
	yMax: float = 0;
	zMin: float = 0;
	zMax: float = 0;
	blocks: dword = 0x00000000;
	sideTextures: SideTextures = new SideTextures();
	matrix: Matrix = new Matrix();
	xTile: dword = 0;
	zTile: dword = 0;
	diagonalFlipped: boolean = false;
	sideFlag1: boolean = true;
	sideFlag2: boolean = true;
	yNW: float = 0;
	ySW: float = 0;
	ySE: float = 0;
	yNE: float = 0;
	yModel: float = 0;
	subfileId: dword = 0x49c05b9f;
	u = new Unknown()
		.byte(0x04)
		.dword(0x00000000)
		.dword(0xc772bf98)
		.byte(0x05)
		.bytes([0, 0, 0, 0, 0])
		.bytes([0x02, 0, 0])
		.dword(0x00000000)
		.bytes([0x10, 0x00, 0x00])
		.byte(0x10)
		.repeat(4, u => u.dword(0x00000000))
		.dword(0x00000001)
		.dword(0x00000000)
		.word(0x0000)
		.float(1)
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x00000001);

	// ## constructor(opts)
	constructor(opts: ConstructorOptions<Pipe> = {}) {
		Object.assign(this, opts);
	}

	// ## parse(rs)
	parse(rs: Stream): this {
		const unknown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		unknown.byte();
		unknown.dword();
		this.appearance = rs.byte();
		unknown.dword();
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zTractSize = rs.word();
		this.sgprops = rs.sgprops();
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		unknown.byte();
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
		this.textureId = rs.dword();
		unknown.bytes(5);
		this.orientation = rs.byte();
		unknown.bytes(3);
		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();
		unknown.dword();
		this.xMin = rs.float();
		this.xMax = rs.float();
		this.yMin = rs.float();
		this.yMax = rs.float();
		this.zMin = rs.float();
		this.zMax = rs.float();
		unknown.bytes(3);
		unknown.byte();
		unknown.repeat(4, () => unknown.dword());
		unknown.dword();
		unknown.dword();
		unknown.word();
		unknown.float();
		this.blocks = rs.dword();
		this.sideTextures = new SideTextures().parse(rs);
		unknown.dword();
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
		unknown.dword();
		unknown.dword();
		rs.assert();
		return this;
	}

	// ## toBuffer()
	toBuffer(): Uint8Array {
		const ws = new WriteBuffer();
		const unknown = this.u.writer(ws);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		unknown.byte();
		unknown.dword();
		ws.byte(this.appearance);
		unknown.dword();
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
		unknown.byte();
		ws.write(this.matrix3);
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		this.vertices.forEach(v => ws.vertex(v));

		// Reading model starts below.
		ws.dword(this.textureId);
		unknown.bytes();
		ws.byte(this.orientation);
		unknown.bytes();
		ws.byte(this.networkType);
		ws.byte(this.westConnection);
		ws.byte(this.northConnection);
		ws.byte(this.eastConnection);
		ws.byte(this.southConnection);
		unknown.dword();
		ws.float(this.xMin);
		ws.float(this.xMax);
		ws.float(this.yMin);
		ws.float(this.yMax);
		ws.float(this.zMin);
		ws.float(this.zMax);
		unknown.bytes();
		unknown.byte();
		unknown.repeat(4, () => unknown.dword());
		unknown.dword();
		unknown.dword();
		unknown.word();
		unknown.float();
		ws.dword(this.blocks);
		ws.write(this.sideTextures);
		unknown.dword();
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
		unknown.dword();
		unknown.dword();
		unknown.assert();
		return ws.seal();
	}

}

// # SideTextures
// Tiny helper class for representing an array of side textures. Provides 
// west, north, east, south and bottom getters to make everything a bit more 
// readable.
class SideTextures extends Array<Vertex[]> {

	constructor() {
		super([], [], [], [], []);
	}

	get west(): Vertex[] { return this[0]; }
	set west(value: Vertex[]) { this[0] = value; }

	get north(): Vertex[] { return this[1]; }
	set north(value: Vertex[]) { this[1] = value; }

	get east(): Vertex[] { return this[2]; }
	set east(value: Vertex[]) { this[2] = value; }

	get south(): Vertex[] { return this[3]; }
	set south(value: Vertex[]) { this[3] = value; }

	get bottom(): Vertex[] { return this[4]; }
	set bottom(value: Vertex[]) { this[4] = value; }

	// ## vertical()
	*vertical(): Generator<Vertex[]> {
		yield this.west;
		yield this.north;
		yield this.east;
		yield this.south;
	}

	// ## parse(rs)
	parse(rs: Stream): this {
		for (let i = 0; i < 5; i++) {
			this[i] = rs.array(() => rs.vertex());
		}
		return this;
	}

	// ## write(ws)
	// Writes to the given buffer. This is a nice alternative to using 
	// toBuffer() because it doesn't require creating a new buffer for writing 
	// small stuff!
	write(ws: WriteBuffer): WriteBuffer {
		for (let side of this) {
			ws.dword(side.length);
			for (let vertex of side) {
				ws.vertex(vertex);
			}
		}
		return ws;
	}

	// ## toBuffer()
	toBuffer(): Uint8Array {
		return this.write(new WriteBuffer()).toBuffer();
	}

}
