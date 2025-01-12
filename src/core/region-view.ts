// # region-view-file.js
import semver from 'semver';
import Stream from './stream.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';
import type { byte, dword, float, word } from 'sc4/types';
import Unknown from './unknown.js';
import WriteBuffer from './write-buffer.js';
import type SGProp from './sgprop.js';

type OccupantGroupInfo = {
	occupantGroup: dword;
	population: dword;
};

// # RegionView
export default class RegionView {
	static [kFileType] = FileType.RegionView;
	version = '1.13';
	x = 0;
	z = 0;
	xSize = 0;
	zSize = 0;
	population: {
		residential: dword;
		commercial: dword;
		industrial: dword;
	};
	rating: byte = 0;
	starCount: byte = 0;
	tutorial: boolean = false;
	guid: dword = 0x00000000;
	mode: 'god' | 'mayor' = 'god';
	name = '';
	formerName = '';
	mayorName = '';
	description = '';
	defaultMayor = 'Jonas Sparks';
	currentInfo: OccupantGroupInfo[] = [];
	maxInfo: OccupantGroupInfo[] = [];
	limits: OccupantGroupInfo[] = [];
	unknownFloats: float[] = [];
	neighbourConnections: NeighbourConnection[] = [];
	u = new Unknown()
		.dword(0x00000000)
		.repeat(5, u => u.dword(0x00000000))
		.repeat(5, u => u.dword(0x00000000))
		.dword(0xffffffff);

	// ## parse(buff)
	// Partially read in. This stuff is pretty much read-only for now, no 
	// need to fully parse it yet.
	parse(buff: Stream | Uint8Array) {
		this.u = new Unknown();
		let rs = new Stream(buff);
		const unknown = this.u.reader(rs);
		this.version = rs.version(2);
		this.x = rs.dword();
		this.z = rs.dword();
		this.xSize = rs.dword();
		this.zSize = rs.dword();
		this.population = {
			residential: rs.dword(),
			commercial: rs.dword(),
			industrial: rs.dword(),
		};
		if (semver.gt(`${this.version}.0`, '1.9.0')) {
			unknown.float();
		}
		if (semver.gt(`${this.version}.0`, '1.10.0')) {
			this.rating = rs.byte();
		}
		this.starCount = rs.byte();
		this.tutorial = rs.bool();
		this.guid = rs.dword();
		unknown.repeat(5, u => u.dword());
		this.mode = rs.byte() === 1 ? 'mayor' : 'god';
		this.name = rs.string();
		this.formerName = rs.string();
		this.mayorName = rs.string();
		this.description = rs.string();
		this.defaultMayor = rs.string();
		unknown.repeat(5, u => u.dword(0x00000000));
		unknown.dword(0xffffffff);
		this.currentInfo = rs.array(() => {
			let occupantGroup = rs.dword();
			let population = rs.dword();
			return { occupantGroup, population };
		});
		this.maxInfo = rs.array(() => {
			let occupantGroup = rs.dword();
			let population = rs.dword();
			return { occupantGroup, population };
		});
		this.limits = rs.array(() => {
			let occupantGroup = rs.dword();
			let population = rs.dword();
			return { occupantGroup, population };
		});
		this.unknownFloats = rs.array(() => rs.float());
		this.neighbourConnections = rs.array(() => {
			return new NeighbourConnection().parse(rs);
		});
		unknown.array(unknown => {
			unknown.dword();
			unknown.dword();
			unknown.bytes(5);
		});
		unknown.dword();
		unknown.float();
		unknown.dword();
		unknown.float();
		unknown.array(unknown => {
			unknown.dword();
			unknown.repeat(5, unknown => {
				unknown.dword();
				unknown.float();
			});
		});
		unknown.array(unknown => unknown.bytes(76));
		unknown.array(unknown => unknown.bytes(76));
		unknown.array(unknown => {
			unknown.dword();
			unknown.array(unknown => {
				unknown.float();
				unknown.float();
				unknown.float();
			});
		});
		rs.assert();
	}
	toBuffer() {
		let ws = new WriteBuffer();
		let unknown = this.u.writer(ws);
		ws.version(this.version);
		ws.dword(this.x);
		ws.dword(this.z);
		ws.dword(this.xSize);
		ws.dword(this.zSize);
		ws.dword(this.population.residential);
		ws.dword(this.population.commercial);
		ws.dword(this.population.industrial);
		if (semver.gt(`${this.version}.0`, '1.9.0')) {
			unknown.float();
		}
		if (semver.gt(`${this.version}.0`, '1.10.0')) {
			ws.byte(this.rating);
		}
		ws.byte(this.starCount);
		ws.bool(this.tutorial);
		ws.dword(this.guid);
		unknown.repeat(5, u => u.dword());
		ws.byte(this.mode === 'mayor' ? 1 : 0);
		ws.string(this.name);
		ws.string(this.formerName);
		ws.string(this.mayorName);
		ws.string(this.description);
		ws.string(this.defaultMayor);
		unknown.repeat(5, u => u.dword());
		unknown.dword();
		ws.array(this.currentInfo, info => {
			ws.dword(info.occupantGroup);
			ws.dword(info.population);
		});
		ws.array(this.maxInfo, info => {
			ws.dword(info.occupantGroup);
			ws.dword(info.population);
		});
		ws.array(this.limits, info => {
			ws.dword(info.occupantGroup);
			ws.dword(info.population);
		});
		ws.array(this.unknownFloats, ws.float);
		ws.array(this.neighbourConnections);
		unknown.array(unknown => {
			unknown.dword();
			unknown.dword();
			unknown.bytes();
		});
		unknown.dword();
		unknown.float();
		unknown.dword();
		unknown.float();
		unknown.array(unknown => {
			unknown.dword();
			unknown.repeat(5, unknown => {
				unknown.dword();
				unknown.float();
			});
		});
		unknown.array(unknown => unknown.bytes());
		unknown.array(unknown => unknown.bytes());
		unknown.array(unknown => {
			unknown.dword();
			unknown.array(unknown => {
				unknown.float();
				unknown.float();
				unknown.float();
			});
		});
		return ws.toUint8Array();
	}
}

class NeighbourConnection {
	version = '1';
	type: dword = 0x00000000;
	connection: [dword, dword] = [0x00000000, 0x00000000];
	destination: [dword, dword] = [0x00000000, 0x00000000];
	byte = 0x00;
	sgprops: SGProp[] = [];
	propertyVersion: word = 2;
	parse(rs: Stream) {
		this.version = rs.version(1);
		this.type = rs.dword();
		this.connection = [rs.dword(), rs.dword()];
		this.destination = [rs.dword(), rs.dword()];
		this.byte = rs.byte();
		this.propertyVersion = rs.word();
		this.sgprops = rs.sgprops();
		return this;
	}
	write(ws: WriteBuffer) {
		ws.version(this.version);
		ws.dword(this.type);
		ws.tuple(this.connection, ws.dword);
		ws.tuple(this.destination, ws.dword);
		ws.byte(this.byte);
		ws.word(this.propertyVersion);
		ws.array(this.sgprops);
	}
}
