import type Stream from './stream.js';
import type WriteBuffer from './write-buffer.js';

type NetworkCrossingOptions = {
	type?: number;
	west?: number;
	north?: number;
	east?: number;
	south?: number;
};

// # NetworkCrossing
// Small helper class that is used within the various network subfiles.
export default class NetworkCrossing {
	type = 0x00;
	west = 0x00;
	north = 0x00;
	east = 0x00;
	south = 0x00;
	constructor(opts?: NetworkCrossingOptions) {
		if (opts) {
			Object.assign(this, opts);
		}
	}
	parse(rs: Stream) {
		this.type = rs.byte();
		this.west = rs.byte();
		this.north = rs.byte();
		this.east = rs.byte();
		this.south = rs.byte();
		return this;
	}
	write(ws: WriteBuffer) {
		ws.byte(this.type);
		ws.byte(this.west);
		ws.byte(this.north);
		ws.byte(this.east);
		ws.byte(this.south);
		return this;
	}
}
