// # network-tunnel-occupant.ts
import type { byte, dword, qword, TGIArray } from 'sc4/types';
import FileType from './file-types.js';
import type SGProp from './sgprop.js';
import type Stream from './stream.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import TractInfo from './tract-info.js';
import Unknown from './unknown.js';
import Vector3 from './vector-3.js';
import type Matrix3 from './matrix-3.js';
import Vertex from './vertex.js';
import Box3 from './box-3.js';
import type Pointer from './pointer.js';

// # NetworkTunnelOccupant
// Represents an entrance of a tunnel. It is is similar to the prebuilt network 
// structure because it also needs a 3D model for the entrance.
export default class NetworkTunnelOccupant {
	static [kFileType] = FileType.NetworkTunnelOccupant;
	static [kFileTypeArray] = true;
	crc = 0x00000000;
	mem = 0x00000000;
	version = '2.4.8.4';
	appearance = 0x05000000;
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
	modelId: dword = 0x00000000;
	wealthTexture: byte = 0x00;
	baseTexture: dword = 0x00000000;
	orientation: byte = 0x00;
	crossings: byte = 0x00;
	networkType: byte = 0x02;
	westConnection: byte = 0x00;
	northConnection: byte = 0x00;
	eastConnection: byte = 0x00;
	southConnection: byte = 0x00;
	walls: ({ texture: dword, vertex: Vertex })[] = [];
	bbox = new Box3();
	constructionStates: dword = 0x00000000;
	pathId: dword = 0x00000000;
	demolishingCosts: qword = 0n;
	sibling: Pointer;
	u = new Unknown()
		.dword(0xc772bf98)
		.bytes([0, 0])
		.dword(0x00000000)
		.dword(0x00000000)
		.dword(0x00000000)
		.float(0)
		.float(0)
		.float(0)
		.bytes([0, 0, 0, 0, 0]);

	// ## parse(rs)
	parse(rs: Stream) {
		this.u = new Unknown();
		const unknown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.version(4);
		this.appearance = rs.dword();
		unknown.dword(0xc772bf98);
		this.tract = rs.tract();
		this.sgprops = rs.sgprops();
		this.tgi = rs.tgi();

		// 0x01 means no transformation matrix, 0x05 means has a transformation matrix.
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
		this.wealthTexture = rs.byte();
		this.baseTexture = rs.dword();
		this.orientation = rs.byte();
		unknown.bytes(2);
		this.crossings = rs.byte();
		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();
		this.walls = rs.array(() => {
			let texture = rs.dword();
			let vertex = rs.vertex();
			return { texture, vertex };
		});
		this.bbox = rs.bbox({ range: true });
		this.constructionStates = rs.dword();
		this.pathId = rs.dword();
		unknown.dword(0x00000000);
		unknown.dword(0x00000000);
		unknown.dword(0x00000000);
		this.demolishingCosts = rs.qword();
		unknown.bytes(21);
		unknown.byte();
		this.sibling = rs.pointer()!;
		rs.assert();
		return this;
	}

}
