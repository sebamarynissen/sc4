// # color.js
'use strict';

// # Color
class Color {
	constructor(r = 0, g = 0, b = 0, a = 0xff) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}
	[Symbol.toPrimitive]() {
		let { r, g, b, a } = this;
		return '#'+pad(r)+pad(g)+pad(b)+pad(a);
	}
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return '\x1B[36m'+String(this)+'\x1B[39m';
	}
}
module.exports = Color;

function pad(value) {
	return value.toString(16).padStart(2, '0');
}
