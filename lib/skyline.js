// # skyline.js
"use strict";
const bsearch = require('binary-search-bounds');
const LotConfigPropertySize = 0x88edc790;
const OccupantSize = 0x27812810;

// # skyline(opts)
// Just for fun: plop a random skyline.
function skyline(opts) {
	let {
		city,
		center = [],
		radius
	} = opts;

	// Make sure to index all lots by height.
	let lots = indexLots(city);

	// Create our skyline function that will determine the maximum height 
	// based on the distance from the center.
	let fn = makeSkylineFunction({
		center,
		radius,
	});

	// Now loop all city tiles & plop away.
	let zones = city.dbpf.zones;
	const { xSize, zSize } = zones;
	for (let x = 0; x < xSize; x++) {
		outer:
		for (let z = 0; z < zSize; z++) {

			// First of all make sure there's no lot yet on this tile. Not 
			// going to overplop lots.
			if (zones.cells[x][z]) {
				continue;
			}

			// Random voids.
			if (Math.random() < 0.1) {
				continue;
			}

			// Calculate the maximum height for this tile & select the 
			// appropriate lot range.
			let max = fn(x, z);
			let last = bsearch.ge(lots, { height: max }, compare);
			
			// No suitable lots found to plop? Pity, go on.
			if (last === 0) {
				continue;
			}

			// Now pick a random lot from the suitable lots. We will favor 
			// higher lots more to create a nicer effect.
			let index = Math.floor(last * Math.random()**0.75);
			let lot = lots[index].entry;

			// Cool, an appropriate lot was found, but we're not done yet. 
			// It's possible if there's no space to plop the lot, we're not 
			// going to bother. Perhaps that we can retry later, but ok.
			// Note: we'll still have to take into account the rotation as 
			// well here!
			let orientation = Math.random()*4 | 0;
			let [width, depth] = lot.read().value(LotConfigPropertySize);
			if (orientation % 2 === 1) {
				[width, depth] = [depth, width];
			}
			for (let i = 0; i < width; i++) {
				for (let j = 0; j < depth; j++) {
					let xx = x + i;
					let zz = z + j;
					let row = zones.cells[xx];
					if (!row || (row && row[zz])) {
						continue outer;
					}
				}
			}

			// Cool, we got space left to plop the lot. Just do it baby.
			city.grow({
				exemplar: lot,
				x,
				z,
				orientation,
			});

		}
	}

}
module.exports = skyline;

// ## makeSkylineFunction(opts)
// Factory for the skyline function that returns an appropriate height for the 
// given (x, z) tile.
function makeSkylineFunction(opts) {
	let {
		center: [
			cx = 32,
			cz = 32,
		],
		min = 15,
		max = 200,
		radius = 32,
	} = opts;
	let diff = (max-min);
	return function(x, z) {
		let t = Math.sqrt((cx-x)**2 + (cz-z)**2) / radius;
		return min+diff*Math.exp(-((2*t)**2));
	};
}

// ## indexLots(city)
// Creates an index of all lots by height that are available to the city.
function indexLots(city) {
	let { index } = city;
	let lots = [];

	// Loop every exemplar that we have indexed. If its a lot configurations 
	// exemplar, then read it so that we can find the building that appears on 
	// the lot.
	for (let entry of index.exemplars) {
		let file = entry.read();

		// Not a Lot Configurations exemplar? Don't bother.
		if (file.value(0x10) !== 0x10) {
			continue;
		}

		// Find the building on the lot.
		let lotObjects = file.lotObjects;
		let rep = lotObjects.find(({ type }) => type === 0x00);
		let IID = rep.IID;

		// Check if the building belongs to a family.
		let family = index.family(IID);
		if (family) {
			let pivot = family[0].read();
			let prop = pivot.prop(OccupantSize);
			if (!prop) {
				let { parent } = pivot;
				pivot = index.find(parent).read();
			}
			if (!pivot) {
				console.warn('Could not find the size for a lot!');
				continue;
			}
			let [width, height, depth] = pivot.prop(OccupantSize).value;
			lots.push({
				entry,
				height,
			});
		} else {

			// TODO...

		}

	}

	lots.sort(compare);
	return lots;

}

// ## compare(a, b)
// The function we use to sort all lots.
function compare(a, b) {
	return a.height - b.height;
}
