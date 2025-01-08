// # plop-all-lots.js
import shuffle from 'knuth-shuffle-seeded';
import { DBPF, Exemplar, Savegame } from 'sc4/core';
import { PluginIndex, FileScanner } from 'sc4/plugins';
import CityManager from './city-manager.js';
import type { Logger } from 'sc4/types';

const LotConfigPropertySize = 0x88edc790;

// # plopAllLots(files)
// This function accepts an array of file patterns and will plop all lots that 
// it finds in those files
type folder = string;
type PlopAllLotsOptions = {
	lots?: string;
	directory?: folder;
	installation?: folder;
	plugins?: folder;
	logger?: Logger;
	random?: number | boolean;
	city: string;
	clear?: boolean;
	bbox?: [number, number, number, number];
	save?: boolean;
	backup?: Function;
	output?: string;
};
export default async function plopAllLots(opts: PlopAllLotsOptions)
	: Promise<Savegame | false>
{

	// First thing we'll do is looking up all lot files with a file scanner.
	let {
		lots: pattern = '**/*',
		directory = process.env.SC4_PLUGINS ?? process.cwd(),
		logger,
	} = opts;
	let lots = await new FileScanner(pattern, { cwd: directory }).walk();
	if (lots.length === 0) {
		logger?.warn(`No lots found in files that match the pattern ${pattern} in ${directory}.`);
	}

	// Check if we have to plop the lots in random order.
	lots.sort();
	let { random: seed } = opts;
	if (seed) {
		if (seed === true) {
			shuffle(lots);
		} else {
			shuffle(lots, seed);
		}
	}

	// First of all we need to index the plugin folder, but only if there are 
	// actually lots to be plopped of course.
	const { installation, plugins } = opts;
	const index = new PluginIndex({ installation, plugins });
	if (lots.length > 0) {
		logger?.progress.start('Building plugin index...');
		await index.build();
		logger?.progress.update('Indexing building & prop families...');
		await index.buildFamilies();
		logger?.progress.succeed('Plugin index built');
	}

	// Open the savegame where we have to plop everything.
	const { city: cityId } = opts;
	const mgr = new CityManager({ index });
	const city = mgr.load(cityId);

	// If we have to clear the city first, do it.
	if (opts.clear) mgr.clear();

	// Now loop all files
	logger?.progress.start('Plopped 0 lots');
	let i = 0;
	const { bbox } = opts;
	for (let file of lots) {
		let dbpf = new DBPF({ file, parse: false });
		await dbpf.parseAsync();
		for (let entry of dbpf.exemplars) {

			// If this is not a lot exemplar, no need to continue.
			let exemplar = entry.read();
			if (exemplar.value(0x10) !== 0x10) continue;
			let pos = findPosition(city, exemplar, bbox);
			if (!pos) {
				let name = exemplar.value(0x20);
				logger?.warn(`Unable to find a suitable position for ${name}`);
				continue;
			}
			let { x, z, orientation } = pos;
			let result = mgr.grow({
				tgi: entry.tgi,
				x,
				z,
				orientation,
			});
			if (result !== false) {
				i++;
				logger?.progress.update(`Plopped ${i} lots`);
			}

		}
	}
	logger?.progress.succeed();

	// Save at last. If a backup function was specified, we'll first call it.
	if (opts.save) {
		if (opts.backup && city.file) {
			await opts.backup(city.file, opts);
		}
		const { output = city.file! } = opts;
		await city.save({ file: output });
	}
	return city;

}

// # findPosition(city, exemplar, bbox)
// Finds a suitable position for the given lot exemplar to plop.
function findPosition(city: Savegame, exemplar: Exemplar, bbox: number[] = []) {
	const [width, depth] = exemplar.value(LotConfigPropertySize) as [number, number];
	const { zoneDeveloper: zones, width: cityWidth, depth: cityDepth } = city;
	const [minX = 0, minZ = 0, maxX = cityWidth, maxZ = cityDepth] = bbox;
	for (let z = minZ; z <= maxZ-depth; z++) {
		outer:
		for (let x = minX; x <= maxX-width; x++) {
			for (let i = 0; i < width; i++) {
				for (let j = 0; j < depth; j++) {
					if (zones.isOccupied(x+i, z+j)) continue outer;
				}
			}

			// If we reach this point, it means there is sufficient space to 
			// grow the lot. Do it.
			return { x, z, orientation: 2 };

		}
	}

	// If we reach this point, it means no suitable position has been found. 
	// Pity.
	return null;

}
