// # network.js
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import Unknown from './unknown.js';
import Vertex from './vertex.js';

// # Network
// A class for representing a single network tile.
export default class Network {

	static [Symbol.for('sc4.type')] = FileType.Network;
	static [Symbol.for('sc4.type.array')] = true;

	// ## constructor()
	constructor(opts) {
		new Unknown(this);
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0008;
		this.minor = 0x0004;
		this.zot = 0x0000;
		this.unknown.byte(0x00);
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
		this.unknown.byte(0x01);

		// Does this exist? Perhaps based on the flag above.
		// this.matrix3 = new Matrix3();
		this.x = 0;
		this.y = 0;
		this.z = 0;

		// Find a way to set the color as 0xffdddbde.
		this.vertices = [
			new Vertex(),
			new Vertex(),
			new Vertex(),
			new Vertex(),
		];
		this.textureId = 0x00000000;
		this.unknown.bytes([0, 0, 0, 0, 0]);
		this.orientation = 0x00;
		this.unknown.bytes([0x02, 0, 0]);
		this.networkType = 0x00;
		this.westConnection = 0x00;
		this.northConnection = 0x00;
		this.eastConnection = 0x00;
		this.southConnection = 0x00;
		this.crossing = 0;
		this.crossingBytes = [];
		this.unknown.bytes([0x00, 0x00, 0x00]);
		this.xMin = 0;
		this.xMax = 0;
		this.yMin = 0;
		this.yMax = 0;
		this.zMin = 0;
		this.zMax = 0;
		this.unknown.bytes([0x01, 0xa0, 0x00, 0x16]);
		repeat(4, () => this.unknown.dword(0x00000000));
		this.unknown.dword(0x00000002);
		this.unknown.dword(0x00000000);
		Object.assign(this, opts);
	}

	// ## parse(rs)
	parse(rs) {
		rs.size();
		new Unknown(this);
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.word();
		this.unknown.byte(rs.byte());
		this.appearance = rs.byte();
		this.unknown.dword(rs.dword());
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
		this.unknown.byte(rs.byte());
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
		this.unknown.bytes(rs.read(5));
		this.orientation = rs.byte();
		this.unknown.bytes(rs.read(3));
		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();
		let crossing = this.crossing = rs.byte();
		if (crossing) {
			this.crossingBytes = rs.read(5);
		}
		this.unknown.bytes(rs.read(3));
		this.xMin = rs.float();
		this.xMax = rs.float();
		this.yMin = rs.float();
		this.yMax = rs.float();
		this.zMin = rs.float();
		this.zMax = rs.float();
		this.unknown.bytes(rs.read(4));
		repeat(4, () => this.unknown.dword(rs.dword()));
		this.unknown.dword(rs.dword());
		this.unknown.dword(rs.dword());
		rs.assert();
		return this;
	}

	// ## toBuffer()
	toBuffer() {
		let ws = new WriteBuffer();
		const unknown = this.unknown.generator();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.word(this.minor);
		ws.word(this.zot);
		ws.byte(unknown());
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
		ws.float(this.x);
		ws.float(this.y);
		ws.float(this.z);
		this.vertices.forEach(v => ws.vertex(v));
		ws.dword(this.textureId);
		ws.write(unknown());
		ws.byte(this.orientation);
		ws.write(unknown());
		ws.byte(this.networkType);
		ws.byte(this.westConnection);
		ws.byte(this.northConnection);
		ws.byte(this.eastConnection);
		ws.byte(this.southConnection);
		ws.byte(this.crossing);
		if (this.crossing) {
			ws.write(this.crossingBytes);
		}
		ws.write(unknown());
		ws.float(this.xMin);
		ws.float(this.xMax);
		ws.float(this.yMin);
		ws.float(this.yMax);
		ws.float(this.zMin);
		ws.float(this.zMax);
		ws.write(unknown());
		repeat(4, () => ws.dword(unknown()));
		ws.dword(unknown());
		ws.dword(unknown());
		return ws.seal();
	}

}

function repeat(n, fn) {
	for (let i = 0; i < n; i++) {
		fn();
	}
}
