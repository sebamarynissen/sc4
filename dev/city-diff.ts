import chalk from 'chalk';
import path from 'node:path';
import { cClass, FileType, Savegame } from 'sc4/core';
import { readRecordsAsBuffers, removePointers } from 'src/core/helpers.js';
import { compareUint8Arrays } from 'uint8array-extras';

let maps: any = {};
function open(file: string) {
	let fullPath = path.join(process.env.USERPROFILE!, 'desktop/timed dev', `${file}.sc4`);
	return new Savegame(fullPath);
}

function run(dbpf: Savegame) {
	let map = maps[dbpf.file!] = {} as any;
	for (let entry of dbpf) {
		let buffers = readRecordsAsBuffers(entry.decompress());
		if (buffers.length === 0) continue;
		// @ts-ignore
		let label = cClass[String(entry.type)];
		buffers.forEach((buffer, index) => {
			let clone = new Uint8Array(buffer);

			// Clear the MEM CRC part of the record header, and then nullify all 
			// memory addresses of the pointers as well so that we don't have 
			// meaningless diffs.
			clone.set([0, 0, 0, 0, 0, 0, 0, 0], 4);
			removePointers(clone);
			map[`${label}#${index}`] = {
				buffer: clone,
				entry,
			};

		});
	}

	return { map, dbpf };
}

let one = run(open('clone1'));
let two = run(open('clone2'));

// Below are the files of which we are sure that they have nothing do to with the prop simulation.
let excluded = new Set<string>([
]);

for (let key of Object.keys(two.map)) {
	let a = one.map[key];
	let b = two.map[key];
	if (!a) {
		console.log(chalk.green(`${key} is new`));
		continue;
	}
	if (compareUint8Arrays(a.buffer, b.buffer) !== 0) {
		let [label] = key.split('#');
		if (!excluded.has(label)) {
			console.log(key);
		}
	}
}

// We will now manually reconstruct the "clone2" city until it works.
let src: any = two.dbpf;
let target: any = one.dbpf;
target.find({ type: FileType.Lot }).file = src.lots;
target.find({ type: FileType.Building }).file = src.buildings;
target.find({ type: FileType.Prop }).file = src.props;

let types = [
	FileType.ItemIndex,
	FileType.PropDeveloper,
];
for (let type of types) {
	target.find({ type }).buffer = src.find({ type }).decompress();
}

target.COMSerializer.set(FileType.Lot, target.lots.length);
target.COMSerializer.set(FileType.Building, target.buildings.length);
target.COMSerializer.set(FileType.Prop, target.props.length);
target.save(path.join(process.env.SC4_REGIONS!, 'suburb/City - clone.sc4'));
