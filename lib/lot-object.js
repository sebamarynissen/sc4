// # lot-object.js
"use strict";
const scale = 0x00100000;

// # LotObject
// A class for easier manipulation of LotConfigPropertyLotObject properties. 
// See www.wiki.sc4devotion.com/index.php?title=LotConfigPropertyLotObject, 
// these represent all objects on a lot.
class LotObject {

	// ## constructor(prop)
	constructor(prop) {
		this.values = prop.value;
	}

	// ## get type()
	get type() { return this.values[0]; }
	set type(value) { this.values[0] = value; }

	// ## get orientation()
	get orientation() { return this.values[2]; }
	set orientation(value) { this.values[2] = value; }

	// ## get x()
	get x() { return this.values[3]/scale; }
	set x(value) { this.values[3] = Math.round(scale*value); }

	// ## get y()
	get y() { return this.values[4]/scale; }
	set y(value) { this.values[4] = Math.round(scale*value); }

	// ## get z()
	get z() { return this.values[5]/scale; }
	set z(value) { this.values[5] = Math.round(scale*value); }

	// ## get IID()
	get IID() {
		return this.values[12];
	}

}

module.exports = LotObject;