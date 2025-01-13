// # plop-all-lots.js
import shuffle from 'knuth-shuffle-seeded';
import { DBPF, Exemplar, ExemplarProperty, Savegame, TGI, Vector3 } from 'sc4/core';
import { PluginIndex, FileScanner } from 'sc4/plugins';
import CityManager from './city-manager.js';
import type { Logger } from 'sc4/types';

// # plopAllLots(files)
// This function accepts an array of file patterns and will plop all lots that 
// it finds in those files
type folder = string;
type PlopAllLotsOptions = {
	lots?: string | string[];
	directory?: folder;
	installation?: folder;
	plugins?: folder;
	logger?: Logger;
	random?: number | boolean | string;
	city: string;
	clear?: boolean;
	bbox?: number[];
	props?: boolean;
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
			shuffle(lots, seed as number);
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
	const { bbox } = opts;
	if (!opts.props) {
		logger?.progress.start('Plopped 0 lots');
		let i = 0;
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
					logger?.warn(
						`Unable to find a suitable position for ${name}`,
					);
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
	}

	// For the props, we first have to build a data structure that holds which 
	// 1x1 m² squares are occupied. We do this from the zone developer.
	if (opts.props) {
		let { width: cityWidth, depth: cityDepth, zoneDeveloper: zones } = city;
		let occupiedBuffer = new ArrayBuffer(cityWidth*cityDepth*16**2);
		let occupied = new Array(16*cityDepth).fill(null).map((_, i) => {
			let width = 16*cityWidth;
			return new Uint8Array(occupiedBuffer, i*width, width);
		});
		for (let z = 0; z < cityDepth; z++) {
			for (let x = 0; x < cityWidth; x++) {
				if (!zones.isOccupied(x, z)) continue;
				let dx = 16*x;
				let dz = 16*z;
				for (let j = 0; j < 16; j++) {
					for (let i = 0; i < 16; i++) {
						occupied[dz+j][dx+i] = 1;
					}
				}
			}
		}

		// Loop all files again, but now look for the props.
		logger?.progress.start('Added 0 props');
		let i = 0;
		for (let file of lots) {
			let dbpf = new DBPF({ file, parse: false });
			await dbpf.parseAsync();
			for (let entry of dbpf.exemplars) {
				let exemplar = entry.read();
				let type = exemplar.get('ExemplarType');
				if (type !== ExemplarProperty.ExemplarType.Prop) continue;
				let position = findPropPosition(city, occupied, exemplar, bbox);
				if (!position) {
					let name = exemplar.get('ExemplarName');
					logger?.warn(
						`Unable to find a suitable positoin for prop ${name}`
					);
					continue;
				}
				let prop = mgr.createProp({
					exemplar,
					position,
					tgi: new TGI(entry.tgi),
				});
				if (prop) {
					i++;
					logger?.progress.update(`Added ${i} props`);
				}
			}
		}
		logger?.progress.succeed();
	}

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
	const [width, depth] = exemplar.get('LotConfigPropertySize') ?? [0, 0];
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

// # findPropPosition(city, exemplar, bbox)
function findPropPosition(
	city: Savegame,
	occupied: Uint8Array[],
	exemplar: Exemplar,
	bbox: number[] = [],
) {
	const s = (x: number) => 16*x;
	const r = (x: number) => Math.ceil(x);
	let { width: cityWidth, depth: cityDepth } = city;
	let [width,, depth] = (exemplar.get('OccupantSize') ?? [0, 0, 0]).map(r);
	let [
		minX = 0,
		minZ = 0,
		maxX = 16*cityWidth,
		maxZ = 16*cityDepth,
	] = bbox.map(s);

	// For the props, we use cells of 1x1 *meters*, but the bbox and city size 
	// are obviously given in tiles.
	for (let z = minZ; z <= maxZ-depth; z++) {
		outer:
		for (let x = minX; x <= maxX-width; x++) {
			for (let i = 0; i < width; i++) {
				for (let j = 0; j < depth; j++) {
					if (occupied[z+j][x+i]) continue outer;
				}
			}

			// If we reach this point, it means there is sufficient space to put 
			// the prop on. We'll return the position, but we'll also fill up 
			// the occupied buffer.
			for (let i = 0; i < width; i++) {
				for (let j = 0; j < depth; j++) {
					occupied[z+j][x+i] = 1;
				}
			}
			return new Vector3(x+width/2, 0, z+depth/2);

		}
	}
	return null;

}
