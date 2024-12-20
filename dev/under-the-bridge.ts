import path from 'node:path';
import { resource } from '#test/files.js';
import { FileType, Savegame } from 'sc4/core';

let output = path.join(
	process.env.SC4_REGIONS!,
	'Plopall/City - Under the bridge.sc4',
);

let dz = -8;
let dx = 0;

let dbpf = new Savegame(resource('City - Under the bridge.sc4'));

const { network, networkIndex, itemIndex } = dbpf;
for (let tile of network) {

	// y !== 270 means not the road we want to move.
	if (tile.position.y !== 270) continue;
	tile.position.z += 16*dz;
	tile.position.x += 16*dx;
	for (let v of tile.vertices) {
		v.z += dz*16;
		v.x += dx*16;
	}
	tile.bbox = tile.bbox.translate([16*dx, 0, 16*dz]);
	tile.tract.update(tile.bbox);

}

itemIndex.rebuild(FileType.Network, network);

for (let tile of networkIndex.tiles) {

	// The road has x = 40 as tile coordinate, so don't touch anything else.
	if (tile.x !== 40) continue;
	if (tile.pointer!.type === FileType.NetworkBridgeOccupant) continue;
	tile.x += dx;
	tile.z += dz;

}

dbpf.save(output);
console.log('saved to', output);
