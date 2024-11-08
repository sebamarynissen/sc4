// # historical-command.js
import path from 'node:path';
import fs from 'node:fs';
import * as api from 'sc4/api';
import logger from './logger.js';
import backup from '../backup.js';

// # historical(options)
export async function historical(city, options) {

	// Verify that the city is a valid savegame.
	let file = path.resolve(process.cwd(), city);
	let ext = path.extname(file);
	if (ext.toLowerCase() !== '.sc4' || !fs.existsSync(file)) {
		logger.error(`${city} is not a SimCity 4 savegame!`);
	}

	// Extract the api options.
	const apiOptions = {
		dbpf: file,
		residential: options.residential,
		commercial: options.commercial,
		industrial: options.industrial,
		agricultural: options.agricultural,
		logger,
		save: true,
		backup,
	};
	await api.historical(apiOptions);

}
