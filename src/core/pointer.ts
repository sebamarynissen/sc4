// # pointer.ts
// Small helper class that represents a pointer to a certain record in the 
// subfile.
import { hex } from 'sc4/utils';
import type { uint32 } from 'sc4/types';
import { getClassType } from './helpers.js';
import type { SavegameRecord } from './types.js';

// # Pointer
export default class Pointer<T extends SavegameRecord | Uint8Array = SavegameRecord> {
	type: uint32;
	address: uint32 = 0x00000000;

	// ## constructor(object, address)
	// We can construct a pointer in two ways. Either directly from a type and 
	// address, or from a record itself.
	constructor(object: Exclude<T, Uint8Array>);
	constructor(type: number, address?: uint32);
	constructor(objectOrType: Exclude<T, Uint8Array> | number, address = 0x00000000) {
		if (typeof objectOrType === 'number') {
			this.type = objectOrType;
			this.address = address;
		} else {
			this.type = getClassType(objectOrType);
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
