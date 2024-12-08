// # unknown.js
import type { byte, double, dword, float, qword, word } from 'sc4/types';
type UnknownType = number | boolean | bigint | Uint8Array;

// # Unknown
// Helper class that we use for easily managing unknown values in data 
// structures used by the game.
export default class Unknown extends Array<UnknownType> {

	constructor(struct: object) {
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
	add(item: UnknownType) {
		this.push(item);
	}
	bool(value: boolean) { this.add(value); }
	byte(value: byte) { this.add(value); }
	word(value: word) { this.add(value); }
	dword(value: dword) { this.add(value); }
	qword(value: qword) { this.add(value); }
	float(value: float) { this.add(value); }
	double(value: double) { this.add(value); }
	bytes(value: Uint8Array) { this.add(new Uint8Array(value)); }

	// ## generator()
	// Creates a generator function that consumes the unknown one by one. This 
	// is useful when serializing a structure to a buffer, hereby consuming all 
	// unknown values.
	generator() {
		let it = this[Symbol.iterator]();
		let result: IteratorResult<UnknownType>;
		const fn = (): unknown => {
			result = it.next();
			if (!result.done) {
				throw new Error(
					`The generator of the unknown has been fully consumed already! There is probably a mismatch between the amount of unknowns read and written.`
				);
			}
			return result.value;
		};
		return Object.assign(fn, {
			bool: () => fn() as boolean,
			byte: () => fn() as byte,
			word: () => fn() as word,
			dword: () => fn() as dword,
			float: () => fn() as float,
			double: () => fn() as double,
			bytes: () => fn() as Uint8Array,
			assert: () => {
				if (!result.done) {
					throw new Error(`The iterator has not been fully consumed! There is probably a mismatch between the amount of unknowns read and written.`)
				}
			},
		});
	}

}
