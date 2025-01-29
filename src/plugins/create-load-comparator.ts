// # sort-load-order.js
// # createLoadComparator()
export default function createLoadComparator() {
	const table = new HashTable();
	return function compare(a: string, b: string): number {
		let ha = table.getHash(a);
		let hb = table.getHash(b);
		let min = Math.min(ha.length, hb.length)-1;
		let i = 0;
		for (; i < min; i++) {
			let a = ha[i];
			let b = hb[i];
			if (a === b) continue;
			return a < b ? -1 : 1;
		}
		
		// If we haven't made a decision by now, it means either both files are 
		// in the same folder, or one folder is a subfolder of the other one.
		if (ha.length === hb.length) {
			let da = ha[i].endsWith('.DAT') ? 1 : -1;
			let db = hb[i].endsWith('.DAT') ? 1 : -1;
			return da-db || ha[i] < hb[i] ? -1 : 1;
		} else {
			return ha.length < hb.length ? -1 : 1;
		}

	};
}

class HashTable {
	table: Record<string, string[]> = Object.create(null);
	getHash(file: string) {
		let arr = this.table[file];
		if (arr) return arr;
		let parts = file.toUpperCase().split(/[\/\\]/);
		return arr = this.table[file] = parts;
	}
}
