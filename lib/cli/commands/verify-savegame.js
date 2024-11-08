// # verify-savegame.js
import path from 'node:path';
import fs from 'node:fs';

export default function verifySavegame(city, opts) {
	let { logger } = opts;
	let file = path.resolve(process.cwd(), city);
	let ext = path.extname(file);
	if (ext.toLowerCase() !== '.sc4' || !fs.existsSync(file)) {
		logger.error(`${city} is not a SimCity 4 savegame!`);
		return false;
	}
	return true;
}
