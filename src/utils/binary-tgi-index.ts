// # binary-tgi-index.ts
import type { TGILiteral } from 'sc4/types';

// Parameters below are tuned for optimal balance between the probability of 
// hash collisions and memory consumption. For the type mask, it turns out that
// with 256, we get a perfect hash function for all the types that are commonly 
// found in game assets - i.e. *not* within savegames. We don't bother too much 
// about collissions for savegames though, as there are only limited collissions 
// in savegames. However, for stuff like plugin indexing for example, the amount 
// of exemplars is huge, so there it's crucial to avoid the collision detection!
const BUCKETS_TYPE = 0x100;
type u32 = number;

function generateMap(
	entries: Uint32Array,
	size: u32,
	hash: (entries: Uint32Array, index: u32) => number,
	label = '',
) {

	// We will first generate the hash for every TGI and then create the linked 
	// lists for every bucket. We need two things for this:
	// 1. A Uint32Array that contains a tuple of the pointer to the first and 
	// last element of the linked list.
	// 2. Another Uint32Array that contains every TGI pointer, and a pointer 
	// to the next element in the linked list.
	performance.mark(`${label}:start`);
	performance.mark(`${label}:hash:start`);
	const mask = size-1;
	const nEntries = entries.length / 3;
	const firstLastTuples = new Uint32Array(2*size).fill(0xffffffff);
	const nextList = new Uint32Array(nEntries).fill(0xffffffff);
	for (let i = 0, iii = 0; i < nEntries; i++, iii += 3) {
		const hashValue = hash(entries, iii) & mask;
		const bucketIndex = (hashValue << 1) >>> 0;	
		const first = firstLastTuples[bucketIndex];
		if (first === 0xffffffff) {
			firstLastTuples[bucketIndex] = i;
			firstLastTuples[bucketIndex+1] = i;
		} else {
			const prevLast = firstLastTuples[bucketIndex+1];
			nextList[prevLast] = i;
			firstLastTuples[bucketIndex+1] = i;
		}
	}
	performance.mark(`${label}:hash:end`);

	// Now build up the actual index. The size of it is known upfront:
	// - "1" slot for the bucket size
	// - "size" slots that points to the start of every bucket
	// - "size" slots for the length value of every bucket
	// - "entries" slots for every pointer to an entry
	performance.mark(`${label}:serialize:start`);
	const output = new Uint32Array(1+2*size+nEntries);
	output[0] = size;
	const pointers = output.subarray(1, 1+size);
	const buckets = output.subarray(1+size);
	for (let i = 0, currentOffset = 0; i < size; i++) {

		// We will now fill up the bucket from the linked list that we've built 
		// up.
		const lengthOffset = currentOffset;
		let count = 0;
		let next = firstLastTuples[(i << 1) >>> 0];
		let j = lengthOffset+1;
		while (next !== 0xffffffff) {
			count++;
			buckets[j++] = next;
			next = nextList[next];
		}
		buckets[lengthOffset] = count;
		pointers[i] = currentOffset;
		currentOffset += count+1;

	}
	performance.mark(`${label}:serialize:end`);
	performance.mark(`${label}:end`);
	return output;

}

// # find(buffer, hash)
// Finds all pointers - with potential collisions - for the given hash.
function find(index: Uint32Array, hash: u32): Uint32Array {
	const size = index[0];
	const mask = size-1;
	const bucketIndex = hash & mask;
	const ptr = 1+size+index[1+bucketIndex]
	const length = index[ptr];
	const start = ptr+1;
	return index.subarray(start, start+length);
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
	t: Uint32Array;
	ti: Uint32Array;
	tgi: Uint32Array;
};

// # Index
export default class Index {
	instance = 0;
	tgis: Uint32Array;
	t: Uint32Array;
	ti: Uint32Array;
	tgi: Uint32Array;
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
			getPerformanceLabel('t', instance),
		);

		// The bucket size for our TGI index depends on the size of the tgis. We 
		// aim for a filling degree of 0.75.
		const amount = tgis.length/3;
		const buckets = nextPowerOf2(amount/0.75);
		let tgi = generateMap(
			tgis,
			buckets,
			hashTypeGroupInstance,
			getPerformanceLabel('tgi', instance),
		);

		// Same for ti.
		let ti = generateMap(
			tgis,
			buckets,
			hashTypeInstance,
			getPerformanceLabel('ti', instance),
		);
		return new Index({ instance, tgis, t, ti, tgi });
	}

	// ## findType()
	// Finds the *pointers* - i.e. indices - to all entries with the given Type 
	// ID.
	findType(type: u32): u32[] {
		const hash = hash32to16(type);
		const pointers = find(this.t, hash);
		const filtered = [];
		for (let i = 0; i < pointers.length; i++) {
			const ptr = pointers[i];
			if (equalsType(this.tgis, 3*ptr, type)) filtered.push(ptr);
		}
		return filtered;
	}

	// ## findTGI(type, group, index)
	// Finds the *pointers* - i.e. indices - to all entries with the given TGI.
	findTGI(type: u32, group: u32, instance: u32): u32[] {
		const hash = hash96to32(type, group, instance);
		const pointers = find(this.tgi, hash);
		const filtered = [];
		for (let i = 0; i < pointers.length; i++) {
			const ptr = pointers[i];
			if (equalsTGI(this.tgis, 3*ptr, type, group, instance)) {
				filtered.push(ptr);
			}
		}
		return filtered;
	}

	// ## findTI(type, index)
	// Finds the *pointers* - i.e. indices - to all entries with the given TI.
	// We're not sure whether we actually need this, as the game only seems to 
	// look for stuff by TGI, so perhaps we can get rid of this.
	findTI(type: u32, instance: u32): u32[] {
		const hash = hash64to32(type, instance);
		const pointers = find(this.ti, hash);
		const filtered = [];
		for (let i = 0; i < pointers.length; i++) {
			const ptr = pointers[i];
			if (equalsTI(this.tgis, 3*ptr, type, instance)) {
				filtered.push(ptr);
			}
		}
		return filtered;
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
			size: this.tgis.length/3,
			indices: Object.entries(indices).map(([name, index]) => {
				const size = index[0];
				const pointers = index.subarray(1, 1+size);
				const buckets = index.subarray(1+size);
				const empty = pointers.reduce(
					(mem, ptr) => mem + (buckets[ptr] === 0 ? 1 : 0),
					0
				);
				const label = this.getPerformanceLabel(name);
				return {
					name,
					buckets: size,
					byteLength: index.byteLength,
					fillingDegree: 1-empty/size,
					performance: [
						measure('Total build time', label),
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

	// ## serialize()
	serialize(): Uint8Array {
		const { tgis, t, ti, tgi } = this;
		const output = new ArrayBuffer(Uint32Array.BYTES_PER_ELEMENT*(
			tgis.length +
			t.length +
			ti.length +
			tgi.length +
			4
		));
		let i = 0;
		const set = (arr: ArrayLike<number>) => {
			const target = new Uint32Array(output, i, arr.length+1);
			target[0] = arr.length;
			target.set(arr, 1);
			i += target.byteLength;
		};
		set(tgis);
		set(t);
		set(ti);
		set(tgi);
		return new Uint8Array(output);
	}

	// ## fromBuffer()
	static fromBuffer({ buffer, byteOffset }: Uint8Array) {
		let i = 0;
		const get = () => {
			const sizeof = Uint32Array.BYTES_PER_ELEMENT;
			const start = byteOffset+i;
			const length = new DataView(buffer, start).getUint32(0, true);
			const copy = new Uint32Array(
				buffer.slice(start+sizeof, start+sizeof*(1+length)),
			);
			i += sizeof*(length+1);
			return copy;
		};
		const tgis = get();
		const t = get();
		const ti = get();
		const tgi = get();
		return new Index({ tgis, t, ti, tgi });
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
// chosen to spread out the bits as much as possible
function hash32to16(x: u32): u32 {
    return ((x * 2654435761) >>> 13);
}

// # hashType()
// The hash function for the type indexing, but which operates by accepting the 
// TGI array and the index of the TGI in the index.
function hashType(entries: Uint32Array, index: u32) {
	return hash32to16(entries[index]);
}

// # equalsType()
// Checks whether the Type ID of two TGIs in the array are equal, by index.
function equalsType(entries: Uint32Array, ptr: u32, type: u32): boolean {
	return entries[ptr] === type;
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
function equalsTGI(
	entries: Uint32Array,
	ptr: u32,
	t: u32,
	g: u32,
	i: u32,
): boolean {

	// Note: groups are more likely to differ, so we use that first. Slight 
	// performance optimization, lol.
	return (
		entries[ptr+1] === g &&
		entries[ptr+2] === i &&
		entries[ptr] === t
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
function equalsTI(
	entries: Uint32Array,
	ptr: u32,
	t: u32,
	i: u32,
): boolean {
	return entries[ptr+2] === i && entries[ptr] === t;
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
