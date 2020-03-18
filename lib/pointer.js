// # pointer.js
// Small helper class that represents a pointer to a certain record in the 
// subfile.
const { hex } = require('./util.js');
class Pointer {

	// ## constructor(type, address)
	constructor(type, address = 0x00000000) {
		this.type = type;
		this.address = address;
	}

	// ## get [Symbol.toPrimitive](hint)
	// Allows you to get the numerical value of the pointer by using +pointer.
	[Symbol.toPrimitive](hint) {
		return hint === 'number' ? this.address : hex(this.address);
	}

}
module.exports = Pointer;
