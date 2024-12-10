// # city-context.js
import type { DBPF } from 'sc4/core';

// # CityContext
// A class for providing some context around a DBPF file, mostly used with 
// savegames. The most important function here is to find all memory addresses 
// that are in use so that we can generate pointers on the fly that are 
// guaranteed to not be in use - instead of relying on random pointers!
export default class CityContext {
	dbpf: DBPF;
	memRefs: Set<number>;
	#mem: 1;

	// ## constructor(dbpf)
	// When constructing the context, it's important that we read in all the 
	// memrefs *immediately*. It's a recipe for trouble if we do this after 
	// the dbpf has been read in already!
	constructor(dbpf: DBPF) {
		this.dbpf = dbpf;
		this.memRefs = new Set();
		for (let { mem } of this.dbpf.memRefs()) {
			this.memRefs.add(mem);
		}
	}

	// ## mem()
	// Returns a memory address (well, just a number actually) that is not in 
	// use in the dbpf file yet. This allows us to insert content in a dbpf 
	// file while ensuring that the memory address of it won't conflict with 
	// another entry.
	mem(): number {
		let ref = this.#mem++;
		while (this.memRefs.has(ref)) {
			ref = this.#mem++;
		}
		return ref;
	}

}
