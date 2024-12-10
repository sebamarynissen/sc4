// # util.ts
import { util } from './node-builtins.js';
import type { Constructor, UnknownRecord } from 'type-fest';
import type { uint32, TGILiteral } from 'sc4/types';
import type { InspectOptionsStylized } from 'node:util';

// Julian day offset between unix epoch and Julian Date 0.
const JULIAN_OFFSET = 2440587.5;
const MS_DAY = 60*60*24*1000;

// Export the node-builtins, taking into account that they might not be 
// available if we're running in the browser.
export * from './node-builtins.js';

// # getUnixFromJulian(d)
export function getUnixFromJulian(d: number) {
	return (d - JULIAN_OFFSET) * MS_DAY;
}

// # getJulianFromUnix(ms)
export function getJulianFromUnix(ms: number | Date) {
	return +ms/MS_DAY + JULIAN_OFFSET;
}

// # invertMap(map)
// Inverts a map.
export function invertMap<K, V>(map: Map<K, V>): Map<V, K> {
	return new Map([...map].map(([K, V]) => [V, K] as [V, K]));
}

// # invert(obj)
// Inverts an object in-place. Beware of keys that are present as values as 
// well!
export function invert(obj: UnknownRecord) {
	let out = Object.create(null);
	let keys = [
		...Object.getOwnPropertyNames(obj),
		...Object.getOwnPropertySymbols(obj),
	];
	for (let key of keys) {
		out[ String(obj[key]) ] = key;
	}
	return out;
}

// # hex(nr, pad)
export function hex(nr: number, pad = 8) {
	return '0x'+(Number(nr).toString(16).padStart(pad, '0'));
}
hex.register = function() {
	if (!('hex' in Number.prototype)) {
		// eslint-disable-next-line no-extend-native
		Object.defineProperty(Number.prototype, 'hex', {
			value(pad?: number) {
				return util!.styleText('yellow', hex(this, pad));
			},
		});
	}
};

// # inspect
// An object that contains some helper functions for nicely showing things when 
// using console.log in Node.
const kInspect = Symbol.for('nodejs.util.inspect.custom');
export const inspect = {
	symbol: kInspect,
	type(value: any) {
		if (!value) return value;
		return {
			[kInspect]() {
				return util!.styleText('cyan', value);
			},
		};
	},
	constructor(value: Constructor<any>) {
		return {
			[kInspect]() {
				return util!.styleText('cyan', value.name);
			},
		};
	},
	hex(value: number, pad?: number) {
		return {
			[kInspect](_depth: number, opts: InspectOptionsStylized) {
				return opts.stylize(hex(value, pad), 'number');
			},
		};
	},
	tgi(object: Partial<TGILiteral>, label?: string) {
		return {
			[kInspect](_depth: number, opts: InspectOptionsStylized, nodeInspect: Function) {
				if (!object) return object;
				let prefix = label ? `${label} ` : '';
				return `${prefix}${nodeInspect({
					type: object.type && inspect.hex(object.type),
					group: object.group && inspect.hex(object.group),
					instance: object.instance && inspect.hex(object.instance),
				}, opts)}`;
			},
		};
	},
};

// # randomId(opts)
// Returns a random id (for us in TGI), optionally accepting a list of ids that 
// we should not use.
export function randomId(opts: { except?: number[] } = {}): number {
	let { except = [] } = opts;
	let set = new Set(except);
	let id;
	do {
		id = Math.floor(Math.random()*0xffffffff)+1;
	} while (set.has(id));
	return id;
}

// # split(buffer)
// Splits the given buffer that contains multiple "SIZE CRC MEM" records into 
// an array that contains the individual records. Note that we don't copy 
// buffers here, we're simply returnning buffer views on top of it.
export function split(buffer: Uint8Array) {
	let offset = 0;
	let slices = [];
	let view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	while (offset < buffer.length) {
		let size = view.getUint32(offset, true);
		let slice = buffer.subarray(offset, offset+size);
		offset += size;
		slices.push(slice);
	}
	return slices;
}

// # chunk(format, str)
// Chunks the given string according to the given format. Useful when we need 
// to debug hex dumps.
export function chunk(format: number[], str: string) {
	let out = [];
	for (let i = 0; i < format.length; i++) {
		let length = format[i];
		out.push(str.slice(0, length));
		str = str.slice(length);
	}
	out.push(str);
	return out.join(' ').trim();
}

// Utilty fundction for updating the string prototype.
chunk.register = function() {
	if (!('chunk' in String.prototype)) {
		// eslint-disable-next-line no-extend-native
		Object.defineProperty(String.prototype, 'chunk', {
			value(format: number[] = []) {
				return chunk([...format, ...Array(100).fill(8)], this);
			},
		});
	}
};

// # bin(nr)
export function bin(nr: number) {
	return '0b'+Number(nr).toString(2).padStart(8, '0');
}

// # tgi(type, group, id)
// Returns a tgi id for the given type, group & id. Used for uniquely 
// identifying files.
export function tgi(type: uint32, group: uint32, id: uint32) {
	return [type, group, id].map(x => hex(x)).join('-');
}

// # getCityPath(city, region)
// Helper function that easily gets the path of the given city in the given 
// region. Note that we automatically prefix with "City - " and postfix with 
// ".sc4".
export function getCityPath(city: string, region = 'Experiments') {
	const path = process.getBuiltinModule('path');
	let file = `City - ${city}.sc4`;
	return path.resolve(
		process.env.SC4_REGIONS ?? process.cwd(),
		region,
		file,
	);
}

// # duplicateAsync(generator)
// Allows re-using the same code for both a synchronous and asynchronous api.
export function duplicateAsync<Y, R, N>(
	generator: (...args: any[]) => Generator<Y, R, N>,
) {
	type Params = Parameters<typeof generator>;
	return {
		sync(...args: Params) {
			let it = generator.call(this, ...args);
			let { done, value } = it.next();
			while (!done) {
				({ done, value } = it.next(value as N));
			}
			return value as R;
		},
		async async(...args: Params) {
			let it = generator.call(this, ...args);
			let { done, value } = it.next();
			while (!done) {
				({ done, value } = it.next(await value as N));
			}
			return value as R;
		},
	};
}
