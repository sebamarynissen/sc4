import type Stream from './stream.js';
import type WriteBuffer from './write-buffer.js';

// # NetworkCrossing
// Small helper class that is used within the various network subfiles.
export default class NetworkCrossing {
	networkType = 0x00;
	westConnection = 0x00;
	northConnection = 0x00;
	eastConnection = 0x00;
	southConnection = 0x00;
	parse(rs: Stream) {
		this.networkType = rs.byte();
		this.westConnection = rs.byte();
		this.northConnection = rs.byte();
		this.eastConnection = rs.byte();
		this.southConnection = rs.byte();
		return this;
	}
	write(ws: WriteBuffer) {
		ws.byte(this.networkType);
		ws.byte(this.westConnection);
		ws.byte(this.northConnection);
		ws.byte(this.eastConnection);
		ws.byte(this.southConnection);
	}
}
