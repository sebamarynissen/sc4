// # prebuilt-network.js
import { FileType } from './enums.js';
import Unknown from './unknown.js';
import Vertex from './vertex.js';
import type { byte, dword, float, qword, TGIArray, word } from 'sc4/types';
import type Stream from './stream.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type SGProp from './sgprop.js';
import Box3 from './box-3.js';
import TractInfo from './tract-info.js';
import Vector3 from './vector-3.js';
import type Matrix3 from './matrix-3.js';
import NetworkCrossing from './network-crossing.js';

// # PrebuiltNetwork
// A class that is used for networks that use prebuilt models, such as 
// elevated highways.
export default class PrebuiltNetwork {
	static [kFileType] = FileType.PrebuiltNetwork;
	static [kFileTypeArray] = true;
	crc: dword = 0x00000000;
	mem: dword = 0x00000000;
	version = '4.8.4';
	appearance: dword = 0x05;
	tract = new TractInfo();
	xTractSize: word = 0;
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
	modelId: dword = 0;
	wealthTexture: byte = 0x00;
	baseTexture: dword = 0x00000000;
	orientation: byte = 0x00;
	crossings: NetworkCrossing[] = [];
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
	pillar: { id: dword; rotation: float; position: Vector3 } | null = null;
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

	parse(rs: Stream): this {
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
		this.wealthTexture = rs.byte();
		this.baseTexture = rs.dword();
		this.orientation = rs.byte();
		unknown.bytes(2);
		this.crossings = new Array<NetworkCrossing>(rs.byte()+1);
		for (let i = 0; i < this.crossings.length; i++) {
			let crossing = new NetworkCrossing().parse(rs);
			this.crossings[i] = crossing;
		}
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
		unknown.float();
		unknown.float();
		unknown.float();
		unknown.bytes(5);
		let pillar = rs.dword();
		if (pillar > 0) {
			this.pillar = {
				id: pillar,
				rotation: rs.float(),
				position: rs.vector3(),
			};
		}
		rs.assert();
		return this;
	}

}
