// # unknown.js
'use strict';

// # Unknown
// Helper class that we use for easily managing unknown values in data 
// structures used by the game.
class Unknown extends Array {

	constructor(struct) {
		super();
		Object.defineProperty(this, 'struct', {
			enumerable: false,
			writable: false,
			value: struct,
		});
		Object.defineProperty(struct, 'unknown', {
			enumerable: false,
			writable: true,
			configurable: true,
			value: this,
		});
	}
	add(item) {
		this.push(item);
	}
	bool(value) { this.add(value); }
	byte(value) { this.add(value); }
	word(value) { this.add(value); }
	dword(value) { this.add(value); }
	float(value) { this.add(value); }
	double(value) { this.add(value); }
	bytes(bytes) { this.add(Buffer.from(bytes)); }
	generator() {
		let it = this[Symbol.iterator]();
		return () => it.next().value;
	}

}
module.exports = Unknown;
