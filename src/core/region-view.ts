// # region-view-file.js
import semver from 'semver';
import Stream from './stream.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';
import type { byte, dword, float, word } from 'sc4/types';
import Unknown from './unknown.js';

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

}

class NeighbourConnection {
	version = '1';
	type: dword = 0x00000000;
	connection: [dword, dword] = [0x00000000, 0x00000000];
	destination: [dword, dword] = [0x00000000, 0x00000000];
	properties: Property[] = [];
	propertyVersion: word = 2;
	parse(rs: Stream) {
		this.version = rs.version(1);
		this.type = rs.dword();
		this.connection = [rs.dword(), rs.dword()];
		this.destination = [rs.dword(), rs.dword()];
		rs.byte();
		this.propertyVersion = rs.word();
		this.properties = rs.array(() => new Property().parse(rs));
		return this;
	}
}

// # Property
// The structure of a property as it appears in the region view file is similar 
// to the Exemplar property format.
class Property {
	id: dword = 0x00000000;
	id2: dword = this.id;
	type: byte = 0x00;
	keyType: byte = 0x80;
	value: unknown;
	u = new Unknown()
		.dword(0x00000000)
		.byte(0x00);
	parse(rs: Stream) {
		this.u = new Unknown();
		const unknown = this.u.reader(rs);
		this.id = rs.dword();
		this.id2 = rs.dword();
		unknown.dword(0x00000000);
		this.type = rs.byte();
		this.keyType = rs.word();
		unknown.byte();
		const reader = getReader(this.type);
		if (this.keyType === 0x80) {
			this.value = rs.array(() => reader(rs));
		} else {
			this.value = reader(rs);
		}
		return this;
	}
}

function getReader(type: byte) {
	switch (type) {
		case 0x01: return (rs: Stream) => rs.uint8();
		case 0x02: return (rs: Stream) => rs.uint16();
		case 0x03: return (rs: Stream) => rs.uint32();
		case 0x07: return (rs: Stream) => rs.int32();
		case 0x08: return (rs: Stream) => rs.bigint64();
		case 0x09: return (rs: Stream) => rs.float();
		case 0x0b: return (rs: Stream) => rs.bool();
		default:
			throw new Error(`Unknown data type ${type}!`);
	}
}
