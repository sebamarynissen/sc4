import path from 'node:path';
import { resource } from '#test/files.js';
import { FileType, Savegame, SavegameContext } from 'sc4/core';

let output = path.join(
	process.env.SC4_REGIONS!,
	'Plopall/City - Under the bridge.sc4',
);

let dbpf = new Savegame(resource('City - Under the bridge - moved.sc4'));
let ctx = new SavegameContext(dbpf);

const { network, networkIndex, itemIndex, bridges } = dbpf;

itemIndex.rebuild(FileType.Network, network);

for (let tile of bridges) {
	// tile.tgi = bridges[3].tgi;
	// tile.modelId = bridges[3].modelId;
	tile.position.z += 16;
	tile.bbox = tile.bbox.translate([0, 0, 16]);
	tile.tract.update(tile.bbox);
}

// for (let tile of networkIndex.tiles) {
// 	let record = ctx.deref(tile.pointer);
// 	for (let crossings of record.crossings) {
// 		console.log(record);
// 	}
// }

// console.log(network[0]);
// for (let tile of bridges) {
// 	for (let crossings of tile.crossings) {
// 		console.log(crossings);
// 	}
// }

// console.log(network[0]);
// console.log(bridges[0]);

// console.log(networkIndex.tiles.length);
for (let tile of networkIndex.tiles) {
	if (tile.pointer.type === FileType.NetworkBridgeOccupant) {
		tile.z += 1;
	}
}

dbpf.save(output);
console.log('saved to', output);
