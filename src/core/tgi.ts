// # tgi.ts
import type { TGIArray, TGILiteral, uint32 } from 'sc4/types'
import { hex, randomId, inspect } from 'sc4/utils';

export default class TGI<T extends uint32 = uint32> {
	type: T = 0x00000000 as T;
	group: uint32 = 0x00000000;
	instance: uint32 = 0x00000000;

	// Generates a random tgi, useful for testing.
	static random<T extends number = uint32>(
		type: T = randomId() as T,
		group: uint32 = randomId(),
		instance: uint32 = randomId(),
	) {
		return new TGI(type, group, instance);
	}

	constructor(tgi: TGIArray<T> | TGILiteral<T>);
	constructor(type: T, group: uint32, instance: uint32);
	constructor();
	constructor(tgiOrType: TGIArray<T> | TGILiteral<T> | T = 0 as T, group: uint32 = 0, instance: uint32 = 0) {
		let type;
		if (Array.isArray(tgiOrType)) {
			[type, group, instance] = tgiOrType;
		} else if (typeof tgiOrType === 'number') {
			type = tgiOrType;
		} else {
			({ type, group, instance } = tgiOrType);
		}
		this.type = type;
		this.group = group!;
		this.instance = instance!;
	}

	[Symbol.for('nodejs.util.inspect.custom')](_level: any, opts: any, nodeInspect: any) {
		let str = [...this]
			.map(nr => nodeInspect(inspect.hex(nr), opts))
			.join(', ');
		return `TGI(${str})`;
	}

	// ## toString()
	toString() {
		return [...this].map(nr => hex(nr)).join(',');
	}

	// ## toArray()
	toArray(): TGIArray {
		return [this.type, this.group, this.instance];
	}

	// ## toBigInt()
	// Converts the TGI to a BigInt, which can be usful for hashing it.
	toBigInt() {
		return BigInt(this.type) << 64n
			| BigInt(this.group) << 32n
			| BigInt(this.instance);
	}

	// ## map()
	map(...args: Parameters<Array<number>['map']>) {
		return this.toArray().map(...args);
	}

	*[Symbol.iterator]() {
		yield this.type;
		yield this.group;
		yield this.instance;
	}

}
