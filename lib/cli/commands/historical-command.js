// # historical-command.js
import path from 'node:path';
import fs from 'node:fs';
import * as api from 'sc4/api';
import logger from '#cli/logger.js';
import backup from '#cli/backup.js';

// # historical(options)
export async function historical(city, options) {

	// Verify that the city is a valid savegame.
	let file = path.resolve(process.cwd(), city);
	let ext = path.extname(file);
	if (ext.toLowerCase() !== '.sc4' || !fs.existsSync(file)) {
		logger.error(`${city} is not a SimCity 4 savegame!`);
		return;
	}

	// Extract the api options.
	const apiOptions = {
		dbpf: file,
		residential: options.residential || options.all,
		commercial: options.commercial || options.all,
		industrial: options.industrial || options.all,
		agricultural: options.agricultural || options.all,
		logger,
		save: true,
		backup,
	};
	await api.historical(apiOptions);

}
