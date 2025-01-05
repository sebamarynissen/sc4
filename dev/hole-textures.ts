// # hole-textures.ts
import path from 'node:path';
import { Savegame, SimGridFileType } from 'sc4/core';
import { resource } from '#test/files.js';
import crc from 'src/core/crc.js';

let input = resource('City - Tunnel mover.sc4');
// let input = path.join(process.env.SC4_REGIONS!, 'Plopall/City - Tunnel mover.sc4');
let dbpf = new Savegame(input);
dbpf.terrain.raw.fill(270);

for (let tile of dbpf.tunnels) {
	console.log(tile.tgi.map(x => x.toString(16)));
	// tile.tgi = [0, 0, 0];
}

// for (let [name, type] of Object.entries(SimGridFileType)) {
// 	let grids = dbpf.find({ type })!.read();
// 	for (let grid of grids) {
// 		if (grid.resolution !== 1) continue;
// 		let map: any = {};
// 		for (let value of grid.data) {
// 			map[value] ??= 0;
// 			map[value]++;
// 		}
// 		if (Object.keys(map).length === 2) {
// 			grid.data.fill(0);
// 		}
// 	}
// }

dbpf.save(
	path.join(process.env.SC4_REGIONS!, 'Plopall/City - Tunnel mover.sc4'),
);
