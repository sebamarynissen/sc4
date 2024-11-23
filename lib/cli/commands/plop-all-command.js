// # plop-all-command.js
import path from 'node:path';
import plop from 'sc4/api/plop-all-lots.js';
import config from '#cli/config.js';
import logger from '#cli/logger.js';
import parseList from '#cli/helpers/parse-list.js';
import ensureIntallation from '#cli/ensure-installation.js';

// # plopAll()
export async function plopAll(city, lots, options = {}) {

	// Make sure that we have all needed folders in the configuration.
	const installation = await ensureIntallation();

	let {
		directory = config.get('folders.plugins'),
		clear = false,
		random = undefined,
		bbox,
	} = options;

	// The bbox still needs to be parsed it is given.
	if (bbox) {
		bbox = parseList(bbox.replaceAll(/[[\]]/g, '')).map(x => +x);
	}
	await plop({
		installation,
		lots,
		directory,
		city: path.resolve(config.get('folders.regions') || '/', city),
		clear,
		bbox,
		logger,
		random,
	});

}
