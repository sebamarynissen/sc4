// # network.ts
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import Unknown from './unknown.js';
import Vertex from './vertex.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type { byte, dword, float, word } from 'sc4/types';
import type Stream from './stream.js';
import type SGProp from './sgprop.js';
import type { ConstructorOptions } from 'sc4/types';
import Box3 from './box-3.js';
import TractInfo from './tract-info.js';

// # Network
// A class for representing a single network tile.
export default class Network {
	static [kFileType] = FileType.Network;
	static [kFileTypeArray] = true;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	major: word = 0x0008;
	minor: word = 0x0004;
	zot: word = 0x0000;
	appearance: byte = 0x05;
	tract = new TractInfo();
	sgprops: SGProp[] = [];
	GID: dword = 0x00000000;
	TID: dword = 0x00000000;
	IID: dword = 0x00000000;
	x: float = 0;
	y: float = 0;
	z: float = 0;
	vertices: [Vertex, Vertex, Vertex, Vertex] = [
		new Vertex(),
		new Vertex(),
		new Vertex(),
		new Vertex(),
	];
	textureId: dword = 0x00000000;
	orientation: byte = 0x00;
	networkType: byte = 0x00;
	westConnection: byte = 0x00;
	northConnection: byte = 0x00;
	eastConnection: byte = 0x00;
	southConnection: byte = 0x00;
	crossing: byte = 0;
	crossingBytes: Uint8Array = new Uint8Array();
	bbox = new Box3();
	u = new Unknown();

	constructor(opts: ConstructorOptions<Network> = {}) {
		const { u } = this;
		u.byte(0x00);
		u.dword(0xc772bf98);
		u.byte(0x01);
		u.bytes([0, 0, 0, 0, 0]);
		u.bytes([0x02, 0, 0]);
		u.bytes([0x00, 0x00, 0x00]);
		u.bytes([0x01, 0xa0, 0x00, 0x16]);
		repeat(4, () => u.dword(0x00000000));
		u.dword(0x00000002);
		u.dword(0x00000000);
		Object.assign(this, opts);
	}

	parse(rs: Stream): this {
		this.u = new Unknown();
		const unknown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		unknown.byte();
		this.appearance = rs.byte();
		unknown.dword();
		this.tract = rs.tract();
		this.sgprops = rs.sgprops();
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		unknown.byte();
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
		this.crossing = rs.byte();
		if (this.crossing) {
			this.crossingBytes = rs.read(5);
		}
		unknown.bytes(3);
		this.bbox = new Box3().parse(rs);
		unknown.bytes(4);
		repeat(4, () => unknown.dword());
		unknown.dword();
		unknown.dword();
		rs.assert();
		return this;
	}

	toBuffer(): Uint8Array {
		let ws = new WriteBuffer();
		const unknown = this.u.writer(ws);
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		unknown.byte();
		ws.byte(this.appearance);
		unknown.dword();
		ws.tract(this.tract);
		ws.array(this.sgprops);
		ws.dword(this.GID);
		ws.dword(this.TID);
		ws.dword(this.IID);
		unknown.byte();
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		this.vertices.forEach(v => ws.vertex(v));
		ws.dword(this.textureId);
		unknown.bytes();
		ws.byte(this.orientation);
		unknown.bytes();
		ws.byte(this.networkType);
		ws.byte(this.westConnection);
		ws.byte(this.northConnection);
		ws.byte(this.eastConnection);
		ws.byte(this.southConnection);
		ws.byte(this.crossing);
		if (this.crossing) {
			ws.write(this.crossingBytes);
		}
		unknown.bytes();
		ws.bbox(this.bbox);
		unknown.bytes();
		repeat(4, () => unknown.dword());
		unknown.dword();
		unknown.dword();
		return ws.seal();
	}
}

function repeat(n: number, fn: () => void): void {
	for (let i = 0; i < n; i++) {
		fn();
	}
}
