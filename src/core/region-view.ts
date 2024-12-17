// # region-view-file.js
import semver from 'semver';
import Stream from './stream.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';
import type { byte, dword, float } from 'sc4/types';
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
	}

}

class NeighbourConnection {
	version = '1';
	parse(rs: Stream) {
		this.version = rs.version(1);
		this.type = rs.dword();
		this.connection = [rs.dword(), rs.dword()];
		this.destination = [rs.dword(), rs.dword()];
		rs.word();
		rs.byte();
		rs.size();
		let rest = rs.rest();
		console.log(Buffer.from(rest));
		// let type = rs.dword();
		// let group = rs.dword();
		// let instance = rs.dword();
		// let dataType = rs.byte();
		// let repeat1 = rs.word();
		// console.log(dataType, repeat1);
		// rs.array(() => {
		// 	let type = rs.dword();
		// 	let group = rs.dword();
		// 	let instance = rs.dword();
		// 	let dataType = rs.byte();
		// 	let repeat1 = rs.word();
		// 	let repeat2 = rs.byte();
		// 	let count = repeat1 || repeat2 || 1;
		// 	console.log({ repeat1, repeat2, count, dataType });
		// 	for (let i = 0; i < count; i++) {
		// 		if (dataType === 0x02) {
		// 			rs.word();
		// 		} else if (dataType === 0x03) {
		// 			rs.dword();
		// 		} else if (dataType === 0x09) {
		// 			rs.float();
		// 			console.log(rs.rest());
		// 		}
		// 	}
		// });
		return this;
	}
}
