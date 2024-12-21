import path from 'node:path';
import { resource } from '#test/files.js';
import {
	FileType,
	Savegame,
} from 'sc4/core';

let output = path.join(
	process.env.SC4_REGIONS!,
	'Plopall/City - Tunnel mover.sc4',
);

let dz = 0;
let dx = -8;

let dbpf = new Savegame(resource('City - Tunnel mover.sc4'));

const { tunnels, network, networkIndex, itemIndex } = dbpf;
console.log(tunnels[0].mem);

for (let tile of network) {
	tile.position.x += dx*16;
	tile.position.z += dz*16;
	for (let v of tile.vertices) {
		v.x += dx*16;
		v.z += dz*16;
	}
	tile.bbox = tile.bbox.translate([16*dx, 0, 16*dz]);
	tile.tract.update(tile.bbox);
}
for (let tile of tunnels) {
	tile.position.x += dx*16;
	tile.position.z += dz*16;
	for (let v of tile.vertices) {
		v.x += dx*16;
		v.z += dz*16;
	}
	tile.bbox = tile.bbox.translate([16*dx, 0, 16*dz]);
	tile.tract.update(tile.bbox);
}

itemIndex.rebuild(FileType.Network, network);
itemIndex.rebuild(FileType.NetworkTunnelOccupant, tunnels);

for (let tile of networkIndex.tiles) {
	tile.x += dx;
	tile.z += dz;
}

dbpf.save(output);
console.log('Saved to', output);
