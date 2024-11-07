// # prebuilt-network.js
import { FileType } from './enums.js';
import Unknown from './unknown.js';
import Vertex from './vertex.js';

// # PrebuiltNetwork
// A class that is used for networks that use prebuilt models, such as 
// elevated highways.
export default class PrebuiltNetwork {

	static [Symbol.for('sc4.type')] = FileType.PrebuiltNetwork;
	static [Symbol.for('sc4.type.array')] = true;

	// ## constructor()
	constructor() {
		let u = new Unknown(this);
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0004;
		this.minor = 0x0008;
		this.zot = 0x04;
		u.dword(0x00000000);
		this.appearance = 0x05;
		u.dword(0xc772bf98);
		this.xMinTract = 0x00;
		this.zMinTract = 0x00;
		this.xMaxTract = 0x00;
		this.zMaxTract = 0x00;
		this.sgprops = [];
		this.GID = 0x00000000;
		this.TID = 0x00000000;
		this.IID = 0x00000000;
		u.byte(0x01);
		this.x = 0;
		this.y = 0;
		this.z = 0;
		this.vertices = [
			new Vertex(),
			new Vertex(),
			new Vertex(),
			new Vertex(),
		];
		u.bytes([0, 0, 0, 0, 0]);
		this.orientation = 0x00;
		this.networkType = 0x02;
		this.westConnection = 0x00;
		this.northConnection = 0x00;
		this.eastConnection = 0x00;
		this.southConnection = 0x00;
		u.bytes([0, 0, 0, 0, 0, 0, 0]);
		this.xMin = 0;
		this.xMax = 0;
		this.yMin = 0;
		this.yMax = 0;
		this.zMin = 0;
		this.zMax = 0;
		u.bytes([0, 0, 0, 0]);
		repeat(4, () => u.dword(0x00000000));
		this.rest = [];
	}

	// ## parse(rs)
	parse(rs) {
		let u = new Unknown(this);
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.minor = rs.word();
		this.zot = rs.byte();
		u.dword(rs.dword());
		this.appearance = rs.byte();
		u.dword(rs.dword());
		this.xMinTract = rs.byte();
		this.zMinTract = rs.byte();
		this.xMaxTract = rs.byte();
		this.zMaxTract = rs.byte();
		this.xTractSize = rs.word();
		this.zMaxTract = rs.word();
		this.sgprops = rs.sgprops();
		this.GID = rs.dword();
		this.TID = rs.dword();
		this.IID = rs.dword();
		u.byte(rs.byte());
		this.x = rs.float();
		this.y = rs.float();
		this.z = rs.float();
		this.vertices = [
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
			rs.vertex(),
		];
		this.modelId = rs.dword();
		u.bytes(rs.read(5));
		this.orientation = rs.byte();
		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();
		u.bytes(rs.read(7));
		this.xMin = rs.float();
		this.xMax = rs.float();
		this.yMin = rs.float();
		this.yMax = rs.float();
		this.zMin = rs.float();
		this.zMax = rs.float();
		u.bytes(rs.read(4));
		repeat(4, () => u.dword(rs.dword()));
		this.rest = rs.rest();
		rs.assert();
	}

}

function repeat(n, fn) {
	for (let i = 0; i < n; i++) {
		fn();
	}
}
