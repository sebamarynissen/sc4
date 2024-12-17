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
import WriteBuffer from './write-buffer.js';
import NetworkCrossing from './network-crossing.js';

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
	crossings: NetworkCrossing[] = [];
	walls: ({ texture: dword, vertex: Vertex })[] = [];
	bbox = new Box3();
	constructionStates: dword = 0x00000000;
	pathId: dword = 0x00000000;
	demolishingCosts: qword = 0n;
	sibling: Pointer;
	u = new Unknown()
		.dword(0xc772bf98)
		.bytes([2, 0])
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
		this.crossings = new Array(rs.byte()+1);
		for (let i = 0; i < this.crossings.length; i++) {
			this.crossings[i] = new NetworkCrossing().parse(rs);
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
		unknown.bytes(21);
		unknown.byte();
		this.sibling = rs.pointer()!;
		rs.assert();
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		const unknown = this.u.writer(ws);
		ws.dword(this.mem);
		ws.version(this.version);
		ws.dword(this.appearance);
		unknown.dword();
		ws.tract(this.tract);
		ws.array(this.sgprops);
		ws.tgi(this.tgi);
		if (this.matrix3) {
			ws.byte(0x05);
			ws.write(this.matrix3);
		} else {
			ws.byte(0x01);
		}
		ws.vector3(this.position);
		this.vertices.forEach(v => ws.vertex(v));
		ws.dword(this.modelId);
		ws.byte(this.wealthTexture);
		ws.dword(this.baseTexture);
		ws.byte(this.orientation);
		unknown.bytes();
		ws.byte(this.crossings.length-1);
		for (let crossing of this.crossings) {
			crossing.write(ws);
		}
		ws.array(this.walls, ({ texture, vertex }) => {
			ws.dword(texture);
			ws.vertex(vertex);
		});
		ws.bbox(this.bbox, { range: true });
		ws.dword(this.constructionStates);
		ws.dword(this.pathId);
		unknown.dword();
		unknown.dword();
		unknown.dword();
		ws.qword(this.demolishingCosts);
		unknown.bytes();
		unknown.byte();
		ws.pointer(this.sibling);
		unknown.assert();
		return ws.seal();
	}

}
