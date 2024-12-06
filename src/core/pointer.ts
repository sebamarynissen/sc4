// # pointer.js
// Small helper class that represents a pointer to a certain record in the 
// subfile.
import { hex, type uint32 } from 'sc4/utils';
import { getTypeFromInstance } from './filetype-map.js';
import type { SavegameRecord } from './types.js';

// # Pointer
export default class Pointer {
	type: uint32 = 0x00000000;
	address: uint32 = 0x00000000;

	// ## constructor(object, address)
	// We can construct a pointer in two ways. Either directly from a type and 
	// address, or from a record itself.
	constructor(object: SavegameRecord);
	constructor(type: uint32, address: uint32);
	constructor(objectOrType: SavegameRecord | number, address = 0x00000000) {
		if (typeof objectOrType === 'number') {
			this.type = objectOrType;
			this.address = address;
		} else {
			this.type = getTypeFromInstance(objectOrType);
			this.address = objectOrType.mem;
		}
	}

	// ## get mem()
	// Proxy to address for legacy purposes.
	get mem() {
		return this.address;
	}
	set mem(value) {
		this.address = value;
	}

	// ## get [Symbol.toPrimitive](hint)
	// Allows you to get the numerical value of the pointer by using +pointer.
	[Symbol.toPrimitive](hint: 'number' | 'string') {
		return hint === 'number' ? this.address : hex(this.address);
	}

	// ## [inspect]()
	// When logging this in the console, format as a pointer.
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return `Pointer(\x1B[32m${hex(this.address)}\x1B[39m, ${hex(this.type)})`;
	}

}
