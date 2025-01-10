// # timed-prop.ts
import { resource } from "#test/files.js";
import CityManager from "sc4/api/city-manager.js";
import { FileType, Savegame } from "sc4/core";
import { PluginIndex } from "sc4/plugins";
import path from 'node:path';
import { removePointers } from "src/core/helpers.js";

run(new Savegame(resource('City - CP before.sc4')));
run(new Savegame(resource('City - CP after.sc4')));
run(new Savegame(resource('City - Conditional.sc4')));
run(new Savegame(resource('City - RCI.sc4')));
run(new Savegame(path.join(process.env.SC4_REGIONS!, 'suburb/City - spamtown.sc4')));
run(new Savegame(resource('City - Large developed.sc4')));
run(new Savegame(resource('city.sc4')));
run(new Savegame(path.join(process.env.SC4_REGIONS!, 'New Sebastia - 2016-07-25 15.15/City - Sebastia (2).sc4')));
run(new Savegame(path.join(process.env.SC4_REGIONS!, 'New Sebastia - 2016-07-25 15.15/City - Maybeline.sc4')));
run(new Savegame(path.join(process.env.SC4_REGIONS!, 'New Sebastia - 2016-07-25 15.15/City - Hector A. Leto International Airport.sc4')));
run(new Savegame(path.join(process.env.SC4_REGIONS!, 'New Sebastia - 2016-07-25 15.15/City - Western Sebastia.sc4')));
run(new Savegame(path.join(process.env.SC4_REGIONS!, 'New Delphina/City - New Delphina.sc4')));
run(new Savegame(path.join(process.env.SC4_REGIONS!, 'New Delphina/City - Nirwana.sc4')));
run(new Savegame(path.join(process.env.SC4_REGIONS!, 'New Delphina/City - Wayside.sc4')));

function run(dbpf: Savegame) {

	let entry = dbpf.find({ type: FileType.PropDeveloper })!;
	// let buffer = entry.decompress();

	entry.read();

	// removePointers(buffer);
	// buffer.set([0, 0, 0, 0, 0, 0, 0, 0], 4);
	// console.log(`new Uint8Array([${buffer}])`);

}

// let output = path.resolve(process.env.SC4_REGIONS!, 'suburb/City - proplop.sc4');
// let source = new Savegame(resource('City - proplop.sc4'));
// // let source = new Savegame(output);
// let index = new PluginIndex({
// 	core: false,
// });
// await index.build();
// await index.buildFamilies();
// let mgr = new CityManager({
// 	dbpf: source,
// 	index,
// });

// mgr.plop({
// 	tgi: [0x6534284a, 0x07bddf1c, 0x550480c4],
// 	x: 0,
// 	z: 0,
// 	orientation: 2,
// });

// source.save(output);
