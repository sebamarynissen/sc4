// # unknown.js
import type { byte, double, dword, float, qword, word } from 'sc4/types';
import type Stream from './stream.js';
import type WriteBuffer from './write-buffer.js';
type UnknownType = number | boolean | bigint | Uint8Array;

// # Unknown
// Helper class that we use for easily managing unknown values in data 
// structures used by the game.
export default class Unknown extends Array<UnknownType> {
	bool(value: boolean ) { this.push(value); }
	byte(value: byte) { this.push(value); }
	word(value: word) { this.push(value); }
	dword(value: dword) { this.push(value); }
	qword(value: qword) { this.push(value); }
	float(value: float) { this.push(value); }
	double(value: double) { this.push(value); }
	bytes(value: number[] | Uint8Array) {
		if (Array.isArray(value)) {
			this.push(new Uint8Array(value));
		} else {
			this.push(value);
		}
	}

	// ## reader(rs)
	reader(rs: Stream) {
		return new UnknownReader(this, rs);
	}

	// ## writer(ws)
	writer(ws: WriteBuffer) {
		return new UnknownWriter(this, ws);
	}

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
			qword: () => fn() as qword,
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

// # UnknownReader
// A helper class to be used when reading unknowns.
class UnknownReader {
	unknown: Unknown;
	rs: Stream;
	constructor(unknown: Unknown, rs: Stream) {
		this.unknown = unknown;
		this.rs = rs;
	}
	bool() { this.unknown.bool(this.rs.bool()); }
	byte() { this.unknown.byte(this.rs.byte()); }
	word() { this.unknown.word(this.rs.word()); }
	dword() { this.unknown.dword(this.rs.dword()); }
	qword() { this.unknown.qword(this.rs.qword()); }
	float() { this.unknown.float(this.rs.float()); }
	double() { this.unknown.double(this.rs.double()); }
	bytes(length?: number) { this.unknown.bytes(this.rs.read(length)); }
}

// # UnkownWriter
class UnknownWriter {
	ws: WriteBuffer;
	generator: ReturnType<Unknown['generator']>;
	constructor(unknown: Unknown, ws: WriteBuffer) {
		this.generator = unknown.generator();
		this.ws = ws;
	}
	bool() { this.ws.bool(this.generator.bool()) };
	byte() { this.ws.byte(this.generator.byte()) };
	word() { this.ws.word(this.generator.word()) };
	dword() { this.ws.dword(this.generator.dword()) };
	qword() { this.ws.qword(this.generator.qword()) };
	float() { this.ws.float(this.generator.float()) };
	double() { this.ws.double(this.generator.double()) };
	bytes() { this.ws.write(this.generator.bytes()) };
	assert() { this.generator.assert(); }
}