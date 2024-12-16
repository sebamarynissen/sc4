// # prebuilt-network.js
import { FileType } from './enums.js';
import Unknown from './unknown.js';
import Vertex from './vertex.js';
import type { byte, dword, word } from 'sc4/types';
import type Stream from './stream.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type SGProp from './sgprop.js';
import Box3 from './box-3.js';
import TractInfo from './tract-info.js';
import Vector3 from './vector-3.js';

// # PrebuiltNetwork
// A class that is used for networks that use prebuilt models, such as 
// elevated highways.
export default class PrebuiltNetwork {
	static [kFileType] = FileType.PrebuiltNetwork;
	static [kFileTypeArray] = true;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	major: word = 0x0004;
	minor: word = 0x0008;
	zot: byte = 0x04;
	appearance: byte = 0x05;
	tract = new TractInfo();
	xTractSize: word = 0;
	sgprops: SGProp[] = [];
	GID: dword = 0x00000000;
	TID: dword = 0x00000000;
	IID: dword = 0x00000000;
	position = new Vector3();
	vertices: [Vertex, Vertex, Vertex, Vertex] = [
		new Vertex(),
		new Vertex(),
		new Vertex(),
		new Vertex(),
	];
	modelId: dword = 0;
	orientation: byte = 0x00;
	networkType: byte = 0x02;
	westConnection: byte = 0x00;
	northConnection: byte = 0x00;
	eastConnection: byte = 0x00;
	southConnection: byte = 0x00;
	bbox = new Box3();
	rest: Uint8Array = new Uint8Array();
	u = new Unknown();

	// ## constructor()
	// The constructor sets up some default unknown values.
	constructor() {
		const { u } = this;
		u.dword(0x00000000);
		u.dword(0xc772bf98);
		u.byte(0x01);
		u.bytes([0, 0, 0, 0, 0]);
		u.bytes([0, 0, 0, 0, 0, 0, 0]);
		u.bytes([0, 0, 0, 0]);
		repeat(4, () => u.dword(0x00000000));
	}

	parse(rs: Stream): this {
		this.u = new Unknown();
		const unknown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.byte();
		unknown.dword();
		this.appearance = rs.byte();
		unknown.dword();
		this.tract = rs.tract();
		this.sgprops = rs.sgprops();
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		unknown.byte();
		this.position = rs.vector3();
		this.vertices = [
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
		];
		this.modelId = rs.dword();
		unknown.bytes(5);
		this.orientation = rs.byte();
		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();
		unknown.bytes(7);
		this.bbox = rs.bbox({ range: true });
		unknown.bytes(4);
		repeat(4, () => unknown.dword());
		this.rest = rs.rest();
		rs.assert();
		return this;
	}

}

function repeat(n: number, fn: () => void): void {
	for (let i = 0; i < n; i++) {
		fn();
	}
}
