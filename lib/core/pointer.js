// # pointer.js
// Small helper class that represents a pointer to a certain record in the 
// subfile.
const { hex, getClassType } = require('sc4/utils');
class Pointer {

	// ## constructor(type, address)
	// We can construct a pointer in two ways. Either directly from a type and 
	// address, or from a record itself.
	constructor(type, address = 0x00000000) {
		if (typeof type === 'number') {
			this.type = type;
			this.address = address;
		} else {
			this.type = getClassType(type);
			this.address = type.mem;
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
	[Symbol.toPrimitive](hint) {
		return hint === 'number' ? this.address : hex(this.address);
	}

	// ## [inspect]()
	// When logging this in the console, format as a pointer.
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return `Pointer(\x1B[32m${hex(this.address)}\x1B[39m, ${hex(this.type)})`;
	}

}
module.exports = Pointer;
