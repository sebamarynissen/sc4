import chalk from 'chalk';

class Segment extends Array {
	constructor(x, z, type = 1) {
		super(x, z);
		this.type = type;
	}
}

function createMap(segments) {
	let map = new Array(64).fill();
	for (let i = 0; i < map.length; i++) {
		map[i] = new Uint8Array(map.length);
	}
	for (let segment of segments) {
		let [P, Q] = segment;
		let dx = Q[0] - P[0];
		let dz = Q[1] - P[1];
		if (Math.abs(dx) > Math.abs(dz)) {
			if (dx < 0) {
				[P, Q] = [Q, P];
				dx = -dx;
			}
			let line = createLine(P, Q);
			for (let x = P[0]; x <= Q[0]; x++) {
				let z = Math.round(line(x));
				map[z][x] = Math.max(map[z][x], segment.type);
			}
		} else {
			P.reverse();
			Q.reverse();
			if (dz < 0) {
				[P, Q] = [Q, P];
			}
			let line = createLine(P, Q);
			for (let z = P[0]; z <= Q[0]; z++) {
				let x = Math.round(line(z));
				map[z][x] = Math.max(map[z][x], segment.type);
			}
		}
	}
	return map;
}

function createLine([x0, y0], [x1, y1]) {
	let m = (y1-y0)/(x1-x0);
	return x => m*(x-x0) + y0;
}

function dump(map) {
	const chars = [' ', 'x', chalk.green('o')];
	for (let i = 0; i < map.length; i++) {
		let row = map[i];
		let out = [];
		for (let i = 0; i < row.length; i++) {
			out.push(chars[row[i]]);
		}
		console.log(out.join(''));
	}
}

function create(x, z, type = 1) {
	let segment = new Segment(x, z, type);
	segments.push(segment);
	return segment;
}

let segments = [];

create([0, 32], [63, 32], 2);
create([0, 37], [63, 37]);
create([32, 0], [32, 63]);
create([37, 0], [37, 63]);
let map = createMap(segments);
dump(map);
