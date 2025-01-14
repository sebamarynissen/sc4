// # tgi.ts
import type { TGIArray, TGILiteral, uint32 } from 'sc4/types'
import { randomId, inspect } from 'sc4/utils';

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

	toArray(): TGIArray {
		return [this.type, this.group, this.instance];
	}

	*[Symbol.iterator]() {
		yield* this.toArray();
	}

}
