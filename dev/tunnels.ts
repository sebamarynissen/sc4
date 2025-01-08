// # tunnels.ts
import path from 'node:path';
import { resource } from '#test/files.js';
import {
	FileType,
	NetworkCrossing,
	NetworkIndexTile,
	NetworkTunnelOccupant,
	Pointer,
	Savegame,
	Vector3,
	Vertex,
	TGI,
} from 'sc4/core';

let source = new Savegame(resource('City - Tunnel.sc4'));
let { tunnels: sourceTunnels } = source;
// console.log(tunnels);
// console.log(networkIndex);
// console.log(sourceTunnels[1]);

let output = path.join(
	process.env.SC4_REGIONS!,
	'Plopall/City - Quantum.sc4',
);

let dbpf = new Savegame(resource('City - Quantum.sc4'));
let { tunnels, itemIndex, networkIndex } = dbpf;

let start = new NetworkTunnelOccupant({
	mem: 0x1,
	tgi: new TGI([ 1697917002, 673312147, 181403648 ]),
	sibling: new Pointer(FileType.NetworkTunnelOccupant, 0x2),
	position: new Vector3(128+8, 270, 128+8),
	vertices: [
		new Vertex({ x: 128, y: 270, z: 128, u: 0, v: 0 }),
		new Vertex({ x: 128, y: 270, z: 128+16, u: 0, v: 0 }),
		new Vertex({ x: 128+16, y: 270, z: 128+16, u: 0, v: 0 }),
		new Vertex({ x: 128+16, y: 270, z: 128, u: 0, v: 0 }),
	],
	crossings: [
		new NetworkCrossing({
			north: 2,
			south: 2,
		}),
	],
	constructionStates: 281583617,
});
start.tract.update(start.bbox);
tunnels.push(start);

let end = new NetworkTunnelOccupant({
	mem: 0x2,
	tgi: new TGI([ 1697917002, 673312147, 181403648 ]),
	sibling: new Pointer(FileType.NetworkTunnelOccupant, 0x1),
	position: new Vector3(128+8, 270, 64+8),
	vertices: [
		new Vertex({ x: 128, y: 270, z: 64, u: 0, v: 0 }),
		new Vertex({ x: 128, y: 270, z: 64+16, u: 0, v: 0 }),
		new Vertex({ x: 128+16, y: 270, z: 64+16, u: 0, v: 0 }),
		new Vertex({ x: 128+16, y: 270, z: 64, u: 0, v: 0 }),
	],
	crossings: [
		new NetworkCrossing({
			north: 2,
			south: 2,
		}),
	],
	constructionStates: 281583617,
	orientation: 2,
});
end.tract.update(end.bbox);
tunnels.push(end);

// Add the tunnels to the network index as well.
console.log(networkIndex);
networkIndex.tileX = 63;
networkIndex.tileZ = 63;
networkIndex.tiles.push(
	new NetworkIndexTile(),
);

// Rebuild the item index with the tunnels.
itemIndex.rebuild(FileType.NetworkTunnelOccupant, tunnels);

// Store the new tunnel length before we save.
dbpf.COMSerializer.set(FileType.NetworkTunnelOccupant, tunnels.length);

dbpf.save(output);
console.log(output);
