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

	get minX() { return signed(this.values[6])/scale; }
	get minZ() { return signed(this.values[7])/scale; }
	get maxX() { return signed(this.values[8])/scale; }
	get maxZ() { return signed(this.values[9])/scale; }
	get usage() { return this.values[10]; }

	// ## get OID()
	// The Object id is rep 12. The wiki says about this:
	// 0xA0000000 = 0,2,4,6,8,a,c,e - Random one of these characters in case 
	// the other ID's are the same.
	// 0x0BBBB000 = Object Family
	// 0x00000CCC = Unique Object ID for this family. Incremental for similar 
	// objects.
	get OID() {
		return this.values[11];
	}

	// ## get IID()
	get IID() {
		return this.values[12];
	}

	// ## get IIDs()
	// Note: every rep starting from 13 can be an IID, that's another way to 
	// create families. We should take this into account as well hence.
	get IIDs() {
		return this.values.slice(12);
	}

}

module.exports = LotObject;

// ## signed(x)
// Helper function that ensures certain 32 bit integers are considered as 
// signed.
let arr = new Int32Array([0]);
function signed(x) {
	arr[0] = x;
	return arr[0];
}
