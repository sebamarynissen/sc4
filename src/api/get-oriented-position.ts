// # get-oriented-position.ts
import { Vector3, type Lot, type LotObject } from 'sc4/core';

type GetOrientedPositionOptions = {
	lotObject: LotObject;
	lot: Lot;
};

// # getOrientedPosition()
// Accepts a lotObject and returns its position as if the lot were plopped at 
// tile (0,0) - i.e. the NW corner of a city with the given orientation as the 
// orientation of the **lot** in the city. Note that this is a bit special 
// because in the Lot Editor, a lot is shown as having an orientation that would 
// correspond to orientation 2 in the city - i.e. facing *South*. City 
// orientation 0 is actually facing *North*, so we have to account for that.
export default function getOrientedPosition(
	{ lotObject, lot }: GetOrientedPositionOptions
): Vector3 {
	let { x, y, z } = lotObject;
	let { orientation, width: lotWidth, depth: lotDepth } = lot;
	let width = 16*lotWidth;
	let depth = 16*lotDepth;
	let oid = ((orientation % 4) + 4) % 4 as 0 | 1 | 2 | 3;
	switch (oid) {
		case 0x00:
			return new Vector3(width-x, y, depth-z);
		case 0x01:
			return new Vector3(z, y, width-x);
		case 0x02:
			return new Vector3(x, y, z);
		case 0x03:
			return new Vector3(depth-z, y, x);
	}
}
