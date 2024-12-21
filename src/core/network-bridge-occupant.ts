// # network-bridge-occupant.ts
import FileType from './file-types.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import Unknown from './unknown.js';
import type Stream from './stream.js';
import type { byte, dword, float, TGIArray } from 'sc4/types';
import TractInfo from './tract-info.js';
import type SGProp from './sgprop.js';
import type Matrix3 from './matrix-3.js';
import Vector3 from './vector-3.js';
import Vertex from './vertex.js';
import Box3 from './box-3.js';
import type NetworkCrossing from './network-crossing.js';
import WriteBuffer from './write-buffer.js';

// # NetworkBridgeOccupant
// A class that is used for the individual parts of bridges. Apparently the 
// structure is exactly the same as the prebuilt network file, which makes sense.
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
	modelId: dword = 0x00000000;
	wealthTexture: byte = 0x00;
	baseTexture: dword = 0x00000000;
	orientation: byte = 0x00;
	crossings: NetworkCrossing[] = [];
	walls: ({ texture: dword, vertex: Vertex })[] = [];
	bbox = new Box3();
	constructionStates: dword = 0x00000000;
	pathId: dword = 0x00000000;
	demolishingCosts = 0n;
	pillar: { id: dword; rotation: float; position: Vector3 } | null = null;
	u = new Unknown()
		.dword(0xc772bf98)
		.bytes([0, 0])
		.repeat(3, u => u.dword(0x00000000))
		.repeat(3, u => u.float(0.0))
		.bytes([0, 0, 0, 0, 0]);

	// # parse(rs)
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
		this.wealthTexture = rs.byte();
		this.baseTexture = rs.dword();
		this.orientation = rs.byte();
		unknown.bytes(2);
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
		unknown.repeat(3, u => u.float());
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

	// # toBuffer()
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
		unknown.float();
		unknown.float();
		unknown.float();
		unknown.bytes();
		if (this.pillar) {
			ws.dword(this.pillar.id);
			ws.float(this.pillar.rotation);
			ws.vector3(this.pillar.position);
		} else {
			ws.dword(0x00000000);
		}
		unknown.assert();
		return ws.seal();
	}

}
