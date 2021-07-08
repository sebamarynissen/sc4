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
	add(item, label = '') {
		this.struct[label || `unknown${this.length}`] = item;
		this.push(item);
	}
	bool(...args) { this.add(...args); }
	byte(...args) { this.add(...args); }
	word(...args) { this.add(...args); }
	dword(...args) { this.add(...args); }
	float(...args) { this.add(...args); }
	double(...args) { this.add(...args); }
	bytes(bytes, ...rest) { this.add(Buffer.from(bytes), ...rest); }
	generator() {
		let it = this[Symbol.iterator]();
		return () => it.next().value;
	}

}
module.exports = Unknown;
