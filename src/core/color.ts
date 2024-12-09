// # color.js
export default class Color {
	r = 0;
	g = 0;
	b = 0;
	a = 0xff;
	constructor(r = 0, g = 0, b = 0, a = 0xff) {
		Object.assign(this, { r, g, b, a });
	}
	[Symbol.toPrimitive](): string {
		let { r, g, b, a } = this;
		return '#'+pad(r)+pad(g)+pad(b)+pad(a);
	}
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return '\x1B[36m'+String(this)+'\x1B[39m';
	}
}

function pad(value: number) {
	return value.toString(16).padStart(2, '0');
}
