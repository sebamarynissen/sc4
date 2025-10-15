// # verify-savegame.ts
import path from 'node:path';
import fs from 'node:fs';
import type { Logger } from 'sc4/types';

type VerifySavegameOptions = {
	logger: Logger;
};

export default function verifySavegame(city: string, opts: VerifySavegameOptions) {
	let { logger } = opts;
	let file = path.resolve(process.cwd(), city);
	let ext = path.extname(file);
	if (ext.toLowerCase() !== '.sc4' || !fs.existsSync(file)) {
		logger.error(`${city} is not a SimCity 4 savegame!`);
		return false;
	}
	return true;
}
