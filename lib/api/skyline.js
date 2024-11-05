// # skyline.js
import LotIndex from './lot-index.js';
const LotConfigPropertySize = 0x88edc790;
const OccupantSize = 0x27812810;
const OccupantGroups = 0xaa1dd396;

// # skyline(opts)
// Just for fun: plop a random skyline.
function skyline(opts) {
	let {
		city,
		center = [],
		radius,
	} = opts;

	// Create the master index for all lots order by height and then filter to 
	// only include RC buildings.
	let lots = new LotIndex(city.index).height
		.query({
			occupantGroups: [
				0x11010,
				0x11020,
				0x11030,
				0x13110,
				0x13120,
				0x13130,
				0x13320,
				0x13330,
			],
		})
		.filter(entry => {

			// Filter out buildings with an insufficient filling degree.
			let [x, z] = entry.size;
			if (Math.max(x, z) > 5) {
				return false;
			}
			
			// Calculate the filling degree.
			if (x*z > 2) {
				let [width, height, depth] = entry.building;
				let fill = (width*depth) / (x*z*16*16);
				if (fill < 0.5 + 0.5*height/400) {
					return false;
				}
			}

			return true;

		});

	// Filter out the residential lots for the suburbs.
	let suburbs = lots
		.filter(entry => entry.occupantGroups.includes(0x11020))
		.filter(entry => entry.zoneTypes.length === 3);

	// Create our skyline function that will determine the maximum height 
	// based on the distance from the center.
	let cluster = makeSkylineFunction({
		center,
		radius,
	});
	let fn = (x, z) => Math.max(10, cluster(x, z));
	// let f = 2;
	// let a = makeSkylineFunction({
	// 	center: [64-f*10, 64-f*5],
	// 	radius: 30,
	// 	max: 400,
	// });
	// let b = makeSkylineFunction({
	// 	center: [64+f*10, 64+f*5],
	// 	radius: 45,
	// 	max: 100,
	// });
	// const fn = function(x, z) {
	// 	return Math.max(10, a(x, z) + b(x, z));
	// };

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

			// Calculate the maximum height for this tile & select the 
			// appropriate lot range.
			let max = fn(x, z);
			let db;
			if (max < 11) {
				db = suburbs;
			} else {
				db = lots.range({ height: 0.25*max }, { height: max });
			}

			// No suitable lots found to plop? Pity, go on.
			if (db.length === 0) {
				continue;
			}

			// Now pick a random lot from the suitable lots. We will favor 
			// higher lots more to create a nicer effect.
			let index = Math.floor(db.length * Math.random()**0.75);
			let { lot } = db[index];

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
					if (xx >= xSize || zz >= zSize) {
						continue outer;
					}
					let row = zones.cells[xx][zz];
					if (row) {
						continue outer;
					}

					// Mock a 8x8 city grid.
					let grid = 16;
					let half = Math.floor(grid/2);
					if (xx % grid === half || zz % grid === half) {
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
		max = 400,
		radius = 32,
	} = opts;
	return function(x, z) {
		let t = Math.sqrt((cx-x)**2 + (cz-z)**2) / radius;
		return max*Math.exp(-((2*t)**2));
	};
}
