// # hash-map.ts
import { SmartBuffer } from 'smart-arraybuffer';

type i32 = number;
type i16 = number;
type i8 = number;

type Head<T> = {
	count: i32;
	next: Node<T> | null;
	tail: Node<T> | null;
	hasCollision: i8;
}

type Node<T> = {
	index: number;
	next: Node<T> | null;
	value: T;
};

const HASH_MASK = 0xffff;
export function generateMap(entries: Uint32Array) {

	// Generate the buckets where we'll keep all the hashes. The amount of 
	// buckets determines the memory consumption of the hash map.
	let buckets: Head<i32>[] = new Array(HASH_MASK+1);
	for (let i = 0; i < buckets.length; i++) {
		buckets[i] = {
			count: 0,
			next: null,
			tail: null,
			hasCollision: 0,
		};
	}

	// Now loop all the tgi's from the entries and add their hashes to the 
	// buckets.
	let length = entries.length/3;
	for (let i = 0; i < length; i++) {
		let type = entries[3*i];
		let hash = hash32to16(type);
		let head = buckets[hash];
		let node: Node<i32> = {
			index: i,
			next: null,
			value: type,
		};
		if (head.tail === null) {
			head.next = node;
			head.tail = node;
			if (head.hasCollision === 0 && head.next.value !== type) {
				head.hasCollision = 1;
			}
		}
		head.tail.next = node;
		head.tail = node;
		head.count++;
	}

	// Now build up the index buffer. We will prepend it with the lookup table 
	// that tells us where a hashed value can be found.
	let buffer = new SmartBuffer({ size: 4096 });
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
		let node = head.next;
		while (node) {
			buffer.writeUInt32LE(node.index);
			node = node.next;
		}

	}
	let ab = buffer.toArrayBuffer();
	return new Index(ab);

}

class Index {
	buffer;
	constructor(buffer: ArrayBuffer) {
		this.buffer = buffer;
	}
	findType(type: i32) {
		let reader = SmartBuffer.fromBuffer(this.buffer);
		let hash = hash32to16(type);
		let offset = reader.readUInt32LE(4*hash);
		if (offset === 0) return [];
		reader.readOffset = offset;
		let hasCollision = reader.readUInt8();
		let length = reader.readUInt32LE();
		let pointers: number[] = new Array(length);
		for (let i = 0; i < length; i++) {
			pointers[i] = reader.readUInt32LE();
		}
		return pointers;
	}
}

// # hash32to16(x)
// Hashes a 32-bit integer to a 16-bit integer. The multiplier is carefully 
// chosen to spread out the bits as much as possible.
function hash32to16(x: i32): i16 {
    return ((x * 2654435761) >>> 16) & HASH_MASK;
}
