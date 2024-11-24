// # plop-all-command.js
import path from 'node:path';
import plop from 'sc4/api/plop-all-lots.js';
import logger from '#cli/logger.js';
import backup from '#cli/backup.js';
import parseList from '#cli/helpers/parse-list.js';

// # plopAll()
export async function plopAll(city, lots, options = {}) {

	let {
		directory,
		clear = false,
		random = undefined,
		bbox,
	} = options;

	// The bbox still needs to be parsed it is given.
	if (bbox) {
		bbox = parseList(bbox.replaceAll(/[[\]]/g, '')).map(x => +x);
	}
	await plop({
		lots,
		directory,
		city: path.resolve(process.env.SC4_REGIONS ?? process.cwd(), city),
		clear,
		bbox,
		random,
		save: true,
		logger,
		backup,
	});

}
