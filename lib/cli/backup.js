// # backup.js
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp-promise';

export default async function backup(file, opts) {
	const { logger } = opts;
	let iso = new Date().toISOString().slice(0, 19).replaceAll(/[-:]/g, '_');
	let { path: dir } = await tmp.dir({ prefix: `sc4cli_${iso}` });
	let destination = path.join(dir, path.basename(file));
	await fs.copyFile(file, destination);
	logger?.info(`A backup was saved to ${destination}`);
}
