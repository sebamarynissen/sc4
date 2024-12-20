// # network-bridge-occupant.ts
import FileType from './file-types.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import Unknown from './unknown.js';
import type Stream from './stream.js';
import type { dword, TGIArray } from 'sc4/types';
import TractInfo from './tract-info.js';
import type SGProp from './sgprop.js';
import type Matrix3 from './matrix-3.js';
import Vector3 from './vector-3.js';
import Vertex from './vertex.js';
import Box3 from './box-3.js';
import type NetworkCrossing from './network-crossing.js';

// # NetworkBridgeOccupant
export default class NetworkBridgeOccupant {
	static [kFileType] = FileType.NetworkBridgeOccupant;
	static [kFileTypeArray] = true;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version: string = '4.8.4';
	appearance: dword = 0x00000005;
	tract = new TractInfo();
	sgprops: SGProp[] = [];
	tgi: TGIArray = [0x00000000, 0x00000000, 0x00000000];
	matrix3: Matrix3 | null = null;
	position = new Vector3();
	vertices: [Vertex, Vertex, Vertex, Vertex] = [
		new Vertex(),
		new Vertex(),
		new Vertex(),
		new Vertex(),
	];
	modelId = 0x00000000;
	crossings: NetworkCrossing[] = [];
	walls: ({ texture: dword, vertex: Vertex })[] = [];
	bbox = new Box3();
	constructionStates: dword = 0x00000000;
	pathId: dword = 0x00000000;
	demolishingCosts = 0n;
	u = new Unknown()
		.dword(0xc772bf98)
	parse(rs: Stream) {
		this.u = new Unknown();
		const unknown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.version(3);
		this.appearance = rs.dword();
		unknown.dword(0xc772bf98);
		this.tract = rs.tract();
		this.sgprops = rs.sgprops();
		this.tgi = rs.tgi();
		let hasMatrix = rs.byte() === 0x05;
		this.matrix3 = hasMatrix ? rs.matrix3() : null;
		this.position = rs.vector3();
		this.vertices = [
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
		];
		this.modelId = rs.dword();
		unknown.bytes(9);
		this.crossings = rs.crossings();
		this.walls = rs.array(() => {
			let texture = rs.dword();
			let vertex = rs.vertex();
			return { texture, vertex };
		});
		this.bbox = rs.bbox({ range: true });
		this.constructionStates = rs.dword();
		this.pathId = rs.dword();
		unknown.repeat(3, u => u.dword(0x00000000));
		this.demolishingCosts = rs.qword();
		unknown.float();
		unknown.float();
		unknown.float();
		unknown.bytes(9);
		rs.assert();
	}
}
