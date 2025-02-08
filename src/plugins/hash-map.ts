// # hash-map.ts
import { SmartBuffer } from 'smart-arraybuffer';

// Parameters below are tuned for optimal balance between the probability of 
// hash collisions and memory consumption.
const HASH_MASK_TYPE = 0xffff;
const HASH_MASK_TGI = 0x3fffff;

type i32 = number;
type i16 = number;
type i8 = number;
type Head = {
	count: i32;
	first: Node | null;
	tail: Node | null;
	hasCollision: i8;
}

type Node = {
	index: number;
	next: Node | null;
};

let collisions = 0;
function generateMap(
	entries: Uint32Array,
	mask: i32,
	hash: (entries: Uint32Array, index: i32) => number,
	equals: (entries: Uint32Array, a: i32, b: i32) => boolean,
) {

	// Generate the buckets where we'll keep all the hashes. The amount of 
	// buckets determines the memory consumption of the hash map.
	let buckets: Head[] = new Array(mask+1);
	for (let i = 0; i < buckets.length; i++) {
		buckets[i] = {
			count: 0,
			first: null,
			tail: null,
			hasCollision: 0,
		};
	}

	// Now loop all the tgi's from the entries and add their hashes to the 
	// buckets.
	let length = entries.length/3;
	for (let i = 0; i < length; i++) {
		let iii = 3*i;
		let head = buckets[hash(entries, iii) & mask];
		let node: Node = {
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
				collisions++;
				head.hasCollision = 1;
			}

		}
		head.count++;
	}

	// Now build up the index buffer. We will prepend it with the lookup table 
	// that tells us where a hashed value can be found.
	let buffer = new SmartBuffer({ size: 8*buckets.length });
	buffer.writeArrayBuffer(new ArrayBuffer(4*buckets.length));

	// Build up the index buffer.
	for (let i = 0; i < buckets.length; i++) {

		// If the bucket is empty, then we won't write it away, and instead just 
		// write 0x00000000 which is a reserved value indicating that the bucket 
		// is empty. We can do this because if there's an actual offset, it will 
		// never be 0 as the lookup table comes first!
		let head = buckets[i];
		if (head.count === 0) {
			buffer.writeUInt32LE(0, 4*i);
			continue;
		}

		// Otherwise we'll write away the bucket data. Most importantly we have 
		// to write in the lookup table where the information can be found.
		buffer.writeUInt32LE(buffer.writeOffset, 4*i);
		buffer.writeUInt8(head.hasCollision);
		buffer.writeUInt32LE(head.count);
		let node = head.first;
		while (node) {
			buffer.writeUInt32LE(node.index);
			node = node.next;
		}

	}
	return buffer.toArrayBuffer();

}

// # find(buffer, hash)
// Finds all pointers - with potential collisions - for the given hash.
function find(buffer: ArrayBuffer, hash: i32) {
	let reader = SmartBuffer.fromBuffer(buffer);
	let offset = reader.readUInt32LE(4*hash);
	if (offset === 0) return { pointers: [], collisions: false };
	reader.readOffset = offset;
	let collisions = reader.readUInt8();
	let length = reader.readUInt32LE();
	let pointers: number[] = new Array(length);
	for (let i = 0; i < length; i++) {
		pointers[i] = reader.readUInt32LE();
	}
	return { pointers, collisions: collisions > 0 };
}

export class Index {
	entries: Uint32Array;
	t: ArrayBuffer;
	tgi: ArrayBuffer;
	masks = {
		t: HASH_MASK_TYPE,
		tgi: HASH_MASK_TGI,
	};
	constructor(entries: Uint32Array) {
		this.entries = entries;
		this.t = generateMap(
			entries,
			this.masks.t,
			hashType,
			equalsType,
		);
		this.tgi = generateMap(
			entries,
			this.masks.tgi,
			hashTypeGroupInstance,
			equalsTypeGroupInstance,
		);
	}
	findType(type: i32) {
		const hash = hash32to16(type) & this.masks.t;
		const { collisions, pointers } = find(this.t, hash);
		if (!collisions) return pointers;
		return pointers.filter(ptr => {
			return this.entries[3*ptr] === type;
		});
	}
	findTGI(type: i32, group: i32, instance: i32) {
		const hash = hash96to32(type, group, instance) & this.masks.tgi;
		const { collisions, pointers } = find(this.tgi, hash);
		if (!collisions) return pointers;
		return pointers.filter(ptr => {
			let iii = 3*ptr;
			return (
				this.entries[iii+1] === group &&
				this.entries[iii+2] === instance &&
				this.entries[iii] === type
			);
		});
	}
}

// # hash32to16(x)
// Hashes a 32-bit integer to a 16-bit integer. The multiplier is carefully 
// chosen to spread out the bits as much as possible.
function hash32to16(x: i32): i16 {
    return ((x * 2654435761) >>> 16);
}

// # hashType()
// The hash function for the type indexing, but which operates by accepting the 
// TGI array and the index of the TGI in the index.
function hashType(entries: Uint32Array, index: i32) {
	return hash32to16(entries[index]);
}

// # equalsType()
// Checks whether the Type ID of two TGIs in the array are equal, by index.
function equalsType(entries: Uint32Array, a: i32, b: i32): boolean {
	return entries[a] - entries[b] === 0;
}

// # hashTGI(t, g, i)
// Hashes 3 32-bit integers to a 32-bit integer.
function hash96to32(t: i32, g: i32, i: i32): i32 {
	let hash = t ^ g;
	hash = hash + i;
	hash = (hash << 5) | (hash >>> 27);
	return (hash >>> 0);
}

// # hashTypeGroupInstance()
// Same as hashType, but now hashes the TGI.
function hashTypeGroupInstance(entries: Uint32Array, index: i32) {
	return hash96to32(
		entries[index],
		entries[index+1],
		entries[index+2],
	);
}

// # equalsTypeGroupInstance()
// Checks whether the Type ID of two TGIs in the array are equal, by index.
function equalsTypeGroupInstance(entries: Uint32Array, a: i32, b: i32): boolean {

	// Note: groups are more likely to differ, so we use that first. Slight 
	// performance optimization, lol.
	return (
		entries[a+1] - entries[b+1] === 0 &&
		entries[a+2] - entries[b+2] === 0 &&
		entries[a] - entries[b] === 0
	);

}