// # pipes-command.js
import path from 'node:path';
import { Savegame } from 'sc4/core';
import PipeManager from 'sc4/api/pipe-manager.js';
import verify from './verify-savegame.js';
import logger from '#cli/logger.js';
import backup from '#cli/backup.js';

// # pipes(city)
export async function pipes(city: string) {

	// Verify that the city is a valid savegame.
	let file = path.resolve(process.cwd(), city);
	if (!verify(file, { logger })) return false;

	// Create a backup and then apply the pipe layout.
	await backup(file, { logger });
	let dbpf = new Savegame(file);
	let mgr = new PipeManager(dbpf);
	mgr.applyOptimalLayout();

	await dbpf.save(file);
	logger.ok(`Saved to ${file}`);

}
