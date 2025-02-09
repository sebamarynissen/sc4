// # binary-tgi-index.ts
import type { TGILiteral } from 'sc4/types';
import { SmartBuffer } from 'smart-arraybuffer';

// Parameters below are tuned for optimal balance between the probability of 
// hash collisions and memory consumption. For the type mask, it turns out that
// if we go down to 0x3ff, then collisions appear in the TypeIDs used by SC4, 
// but not with 0x7ff, so that's what we'll use.
const BUCKETS_TYPE = 0x800;
const MAX_BUCKETS_TGI = 0x20000;

type u32 = number;
type u16 = number;
type u8 = number;
type Head = {
	count: u32;
	first: Node | null;
	tail: Node | null;
	hasCollision: u8;
}

type Node = {
	index: number;
	next: Node | null;
};

function generateMap(
	entries: Uint32Array,
	size: u32,
	hash: (entries: Uint32Array, index: u32) => number,
	equals: (entries: Uint32Array, a: u32, b: u32) => boolean,
	label = '',
) {

	// Generate the buckets where we'll keep all the hashes. The amount of 
	// buckets determines the memory consumption of the hash map.
	performance.mark(`${label}:start`);
	performance.mark(`${label}:buckets:start`);
	const buckets: Head[] = new Array(size);
	const mask = size-1;
	for (let i = 0; i < size; i++) {
		buckets[i] = {
			count: 0,
			first: null,
			tail: null,
			hasCollision: 0,
		};
	}
	performance.mark(`${label}:buckets:end`);

	// Now loop all the tgi's from the entries and add their hashes to the 
	// buckets.
	performance.mark(`${label}:hash:start`);
	const length = entries.length/3;
	for (let i = 0, iii = 0; i < length; i++, iii += 3) {
		const hashValue = hash(entries, iii) & mask;
		const head = buckets[hashValue];
		const node: Node = {
			index: i,
			next: null,
		};
		if (head.tail === null) {
			head.first = head.tail = node;
		} else {
			head.tail.next = node;
			head.tail = node;

			// We will keep track of whether there are any collisions in the 
			// map. That's important so that when performing the final lookup, 
			// we now if we can return the array "as is", or whether we have to 
			// filter out the collissions. For this, we only register a 
			// collision if the current value is **different** from the very 
			// first value.
			if (
				head.hasCollision === 0 &&
				!equals(entries, iii, 3*head.first!.index)
			) {
				head.hasCollision = 1;
			}

		}
		head.count++;
	}
	performance.mark(`${label}:hash:end`);

	// Now build up the index buffer. We will prepend it with the lookup table 
	// that tells us where a hashed value can be found.
	performance.mark(`${label}:serialize:start`);
	const nBuckets = buckets.length;
	const buffer = new SmartBuffer({ size: 8*nBuckets });
	performance.mark('allocate');
	buffer.writeUInt32LE(buckets.length);
	buffer.writeArrayBuffer(new ArrayBuffer(4*nBuckets));

	// Build up the index buffer.
	for (let i = 0, w = 4; i < nBuckets; i++, w += 4) {

		// If the bucket is empty, then we won't write it away, and instead just 
		// write 0x00000000 which is a reserved value indicating that the bucket 
		// is empty. We can do this because if there's an actual offset, it will 
		// never be 0 as the lookup table comes first!
		const head = buckets[i];
		if (head.count === 0) {
			buffer.writeUInt32LE(0, w);
			continue;
		}

		// Otherwise we'll write away the bucket data. Most importantly we have 
		// to write in the lookup table where the information can be found.
		buffer.writeUInt32LE(buffer.writeOffset, w);
		buffer.writeUInt8(head.hasCollision);
		buffer.writeUInt32LE(head.count);
		let node = head.first;
		while (node) {
			buffer.writeUInt32LE(node.index);
			node = node.next;
		}

	}
	const ab = buffer.toArrayBuffer();
	performance.mark(`${label}:serialize:end`);
	performance.mark(`${label}:end`);
	return ab;

}

// # find(buffer, hash)
// Finds all pointers - with potential collisions - for the given hash.
function find(buffer: ArrayBuffer, hash: u32) {
	const reader = SmartBuffer.fromBuffer(buffer);
	const mask = reader.readUInt32LE(0)-1;
	const offset = reader.readUInt32LE(4+4*(hash & mask));
	if (offset === 0) return [];
	reader.readOffset = offset;
	const collisions = reader.readUInt8();
	const length = reader.readUInt32LE();
	const pointers: number[] = new Array(length);
	for (let i = 0; i < length; i++) {
		pointers[i] = reader.readUInt32LE();
	}
	return pointers;
}

// # getPerformanceLabel(name)
// Helper for generting unique labels for measuring build performance.
let instance = 0;
function getPerformanceLabel(name: string, instance: number) {
	return `${name}${instance}`;
}

type IndexOptions = {
	instance?: number;
	tgis: Uint32Array;
	t: ArrayBuffer;
	ti: ArrayBuffer;
	tgi: ArrayBuffer;
};

// # Index
export default class Index {
	instance = 0;
	tgis: Uint32Array;
	t: ArrayBuffer;
	ti: ArrayBuffer;
	tgi: ArrayBuffer;
	private constructor(opts: IndexOptions) {
		this.instance = opts.instance ?? 0;
		this.tgis = opts.tgis;
		this.t = opts.t;
		this.ti = opts.ti;
		this.tgi = opts.tgi;
	}

	// # fromEntries()
	static fromEntries(entries: TGILiteral[]) {
		instance++;
		let tgis = new Uint32Array(3*entries.length);
		let offset = 0;
		for (let tgi of entries) {
			tgis[offset++] = tgi.type;
			tgis[offset++] = tgi.group;
			tgis[offset++] = tgi.instance;
		}
		let t = generateMap(
			tgis,
			BUCKETS_TYPE,
			hashType,
			equalsType,
			getPerformanceLabel('t', instance),
		);

		// The bucket size for our TGI index depends on the size of the tgis, 
		// with a maximum of 0x1ffff+1 because we noticed that about that the 
		// index creation is getting too slow.
		const amount = tgis.length/3;
		const buckets = Math.min(MAX_BUCKETS_TGI, nextPowerOf2(amount/0.75));
		let tgi = generateMap(
			tgis,
			buckets,
			hashTypeGroupInstance,
			equalsTypeGroupInstance,
			getPerformanceLabel('tgi', instance),
		);

		// Same for ti.
		let ti = generateMap(
			tgis,
			buckets,
			hashTypeInstance,
			equalsTypeInstance,
			getPerformanceLabel('ti', instance),
		);
		return new Index({ instance, tgis, t, ti, tgi });
	}

	// ## findType()
	// Finds the *pointers* - i.e. indices - to all entries with the given Type 
	// ID.
	findType(type: u32) {
		const hash = hash32to16(type);
		const pointers = find(this.t, hash);
		return pointers.filter(ptr => {
			return this.tgis[3*ptr] === type;
		});
	}

	// ## findTGI(type, group, index)
	// Finds the *pointers* - i.e. indices - to all entries with the given TGI.
	findTGI(type: u32, group: u32, instance: u32) {
		const hash = hash96to32(type, group, instance);
		const pointers = find(this.tgi, hash);
		return pointers.filter(ptr => {
			let iii = 3*ptr;
			return (
				this.tgis[iii+1] === group &&
				this.tgis[iii+2] === instance &&
				this.tgis[iii] === type
			);
		});
	}

	// ## findTI(type, index)
	// Finds the *pointers* - i.e. indices - to all entries with the given TI.
	// We're not sure whether we actually need this, as the game only seems to 
	// look for stuff by TGI, so perhaps we can get rid of this.
	findTI(type: u32, instance: u32) {
		const hash = hash64to32(type, instance);
		const pointers = find(this.ti, hash);
		return pointers.filter(ptr => {
			let iii = 3*ptr;
			return (
				this.tgis[iii+2] === instance &&
				this.tgis[iii] === type
			);
		});
	}

	// ## getPerformanceLabel()
	getPerformanceLabel(name: string) {
		return getPerformanceLabel(name, this.instance);
	}

	// ## getStats()
	// Returns a bunch of stats about the index, useful for debugging & 
	// profiling purposes.
	getStats() {
		const indices = { t: this.t, ti: this.ti, tgi: this.tgi };
		return {
			tgiCount: this.tgis.length/3,
			indices: Object.entries(indices).map(([name, ab]) => {
				const dv = new DataView(ab);
				const buckets = dv.getUint32(0, true);
				const max = 4*buckets+1;
				let empty = 0;
				let collisions = 0;
				for (let i = 4; i < max; i += 4) {
					const offset = dv.getUint32(i, true);
					if (offset === 0) {
						empty++;
						continue;
					}
					const hasCollision = dv.getUint8(offset) > 0;
					if (hasCollision) {
						collisions++;
					}
				}
				let label = this.getPerformanceLabel(name);
				return {
					name,
					buckets,
					byteLength: ab.byteLength,
					fillingDegree: 1-empty/buckets,
					collisions,
					performance: [
						measure('Total build time', label),
						measure('Allocate buckets', label, 'buckets'),
						measure('Insert values', label, 'hash'),
						measure('Serialize buffer', label, 'serialize'),
					].map(measure => {
						return {
							name: measure.name,
							duration: measure.duration,
						};
					}),
				};
			}),
		};
	}

}

function measure(name: string, label: string, sublabel?: string) {
	let sub = sublabel ? `:${sublabel}` : '';
	return performance.measure(
		name,
		`${label}${sub}:start`,
		`${label}${sub}:end`,
	);
}

// # hash32to16(x)
// Hashes a 32-bit integer to a 16-bit integer. The multiplier is carefully 
// chosen to spread out the bits as much as possible.
function hash32to16(x: u32): u16 {
    return ((x * 2654435761) >>> 16);
}

// # hashType()
// The hash function for the type indexing, but which operates by accepting the 
// TGI array and the index of the TGI in the index.
function hashType(entries: Uint32Array, index: u32) {
	return hash32to16(entries[index]);
}

// # equalsType()
// Checks whether the Type ID of two TGIs in the array are equal, by index.
function equalsType(entries: Uint32Array, a: u32, b: u32): boolean {
	return entries[a] - entries[b] === 0;
}

// # hashTGI(t, g, i)
// Hashes 3 32-bit integers to a 32-bit integer. Optimized for generating as 
// mush unique hashas as possible for TGIs.
function hash96to32(t: u32, g: u32, i: u32) {
	t = Math.imul(t, 2654435761) ^ (t >> 5);
	g ^= t; 
	i ^= t;
	g = Math.imul(g, 0x9E3779B9);
	i = Math.imul(i, 0x85EBCA6B);
	g ^= g >> 16;
	i ^= i >> 13;
	return (g ^ i) >>> 0;
}

// # hashTypeGroupInstance()
// Same as hashType, but now hashes the TGI.
function hashTypeGroupInstance(entries: Uint32Array, index: u32) {
	return hash96to32(
		entries[index],
		entries[index+1],
		entries[index+2],
	);
}

// # equalsTypeGroupInstance()
// Checks whether the Type ID of two TGIs in the array are equal, by index.
function equalsTypeGroupInstance(entries: Uint32Array, a: u32, b: u32): boolean {

	// Note: groups are more likely to differ, so we use that first. Slight 
	// performance optimization, lol.
	return (
		entries[a+1] - entries[b+1] === 0 &&
		entries[a+2] - entries[b+2] === 0 &&
		entries[a] - entries[b] === 0
	);

}

// # hash64to32(t, g, i)
// Hashes 2 32-bit integers to a 32-bit integer. Optimized for generating as 
// much unique hashas as possible for TIs.
function hash64to32(t: u32, i: u32) {
	return ((Math.imul(t, 2654435761) ^ (t >> 5)) ^ i) >>> 0

}

// # hashTypeInstance()
// Same as hashType, but now hashes the TGI.
function hashTypeInstance(entries: Uint32Array, index: u32) {
	return hash64to32(
		entries[index],
		entries[index+2],
	);
}

// # equalsTypeInstance()
// Checks whether the Type ID of two TGIs in the array are equal, by index.
function equalsTypeInstance(entries: Uint32Array, a: u32, b: u32): boolean {
	return (
		entries[a+2] - entries[b+2] === 0 &&
		entries[a] - entries[b] === 0
	);
}

// # nextPowerOf2(n)
// Finds the next power of 2 to automatically calculate the bucket size.
function nextPowerOf2(n: u32): u32 {
	if (n < 1) return 1;
	n--;
	n |= n >> 1;
	n |= n >> 2;
	n |= n >> 4;
	n |= n >> 8;
	n |= n >> 16;
	return n + 1;
}
