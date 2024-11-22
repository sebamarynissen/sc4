// # plop-all-command.js
import path from 'node:path';
import plop from 'sc4/api/plop-all-lots.js';
import config from '#cli/config.js';
import logger from '#cli/logger.js';

// # plopAll()
export async function plopAll(city, lots, options = {}) {
	let {
		directory = config.get('folders.plugins'),
		clear = false,
		random = undefined,
		bbox,
	} = options;

	// The bbox still needs to be parsed it is given.
	if (bbox) {
		bbox = bbox.split(',').map(x => +x.replaceAll(/[[\]]/g, ''));
	}
	await plop({
		lots,
		directory,
		city: path.resolve(config.get('folders.regions') || '/', city),
		clear,
		bbox,
		logger,
		random,
	});

}
