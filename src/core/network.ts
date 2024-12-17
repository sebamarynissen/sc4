// # network.ts
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import Unknown from './unknown.js';
import Vertex from './vertex.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type { byte, dword, qword, TGIArray } from 'sc4/types';
import type Stream from './stream.js';
import type SGProp from './sgprop.js';
import type { ConstructorOptions } from 'sc4/types';
import Box3 from './box-3.js';
import TractInfo from './tract-info.js';
import { Vector3, type Vector3Like } from './vector-3.js';
import NetworkCrossing from './network-crossing.js';

// # Network
// A class for representing a single network tile.
export default class Network {
	static [kFileType] = FileType.Network;
	static [kFileTypeArray] = true;
	crc: dword = 0x00000000;
	version = '8.4';
	mem: dword = 0x00000000;
	appearance: dword = 0x0500000000;
	tract = new TractInfo();
	sgprops: SGProp[] = [];
	tgi: TGIArray = [0x00000000, 0x00000000, 0x00000000];
	position = new Vector3();
	vertices: [Vertex, Vertex, Vertex, Vertex] = [
		new Vertex(),
		new Vertex(),
		new Vertex(),
		new Vertex(),
	];
	textureId: dword = 0x00000000;
	wealthTexture: byte = 0x00;
	baseTexture: dword = 0x00000000;
	orientation: byte = 0x00;
	crossings: NetworkCrossing[] = [];
	walls: ({ texture: dword, vertex: Vertex })[] = [];
	bbox = new Box3();
	constructionStates: dword = 0x00000000;
	alternatePathId: dword = 0x00000000;
	demolishingCosts: qword = 0n;
	u = new Unknown()
		.dword(0xc772bf98)
		.byte(0)
		.bytes([0, 0])
		.repeat(3, u => u.dword(0x00000000));

	constructor(opts: ConstructorOptions<Network> = {}) {
		Object.assign(this, opts);
	}

	// ## move()
	move(offset: Vector3Like) {
		this.bbox = this.bbox.translate(offset);
		this.tract.update(this);
	}

	parse(rs: Stream): this {
		this.u = new Unknown();
		const unknown = this.u.reader(rs);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.version = rs.version(2);
		this.appearance = rs.dword();
		unknown.dword(0xc772bf98);
		this.tract = rs.tract();
		this.sgprops = rs.sgprops();
		this.tgi = rs.tgi();
		unknown.byte();
		this.position = rs.vector3();
		this.vertices = [
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
		];
		this.textureId = rs.dword();
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
		this.alternatePathId = rs.dword();
		unknown.repeat(3, u => u.dword());
		this.demolishingCosts = rs.qword();
		rs.assert();
		return this;
	}

	toBuffer(): Uint8Array {
		let ws = new WriteBuffer();
		const unknown = this.u.writer(ws);
		ws.dword(this.mem);
		ws.version(this.version);
		ws.dword(this.appearance);
		unknown.dword();
		ws.tract(this.tract);
		ws.array(this.sgprops);
		ws.tgi(this.tgi);
		unknown.byte();
		ws.vector3(this.position);
		this.vertices.forEach(v => ws.vertex(v));
		ws.dword(this.textureId);
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
		ws.dword(this.alternatePathId);
		unknown.repeat(3, u => u.dword());
		ws.qword(this.demolishingCosts);
		unknown.assert();
		return ws.seal();
	}
}
