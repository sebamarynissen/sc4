// # version.ts
import { styleText } from 'node:util';

// # Version
// Small helper class for easily working with versions that often appear in 
// files.
export default class Version {
	parts: number[];
	constructor(versionString: string) {
		this.parts = versionString.split('.').map(Number);
	}
	get major() { return this.parts[0]; }
	get minor() { return this.parts[1]; }
	get patch() { return this.parts[2]; }
	toString() {
		return this.parts.join('.');
	}
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return styleText('yellow', String(this));
	}
	*[Symbol.iterator]() {
		yield* this.parts;
	}
}
