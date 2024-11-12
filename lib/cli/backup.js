// # backup.js
import fs from 'node:fs/promises';
import path from 'node:path';
import config from './config.js';
const backupDir = path.resolve(path.dirname(config.path), '../backups');

// # backup()
// Creates a new backup, while also verifying any expired backups.
export default async function backup(file, opts) {
	const { logger } = opts;
	await clean({ logger });
	let iso = dateToDir(new Date());
	let dir = path.join(backupDir, iso);
	await fs.mkdir(dir, { recursive: true });
	let destination = path.join(dir, path.basename(file));
	await fs.copyFile(file, destination);
	logger?.info(`A backup was saved to ${destination}`);
}

// # clean(opts)
// Cleans the backup folder by removing any backups older than 14 days.
export async function clean(opts = {}) {
	const { logger } = opts;
	let list = await fs.readdir(backupDir);
	let now = Date.now();
	let tasks = [];
	for (let dirname of list) {
		let year = dirname.slice(0, 4);
		let month = dirname.slice(4, 6);
		let date = dirname.slice(6, 8);
		let when = new Date(+year, +month-1, +date, 0, 0, 0);
		if (now - when > 60e3*60*24*14) {
			let fullPath = path.join(backupDir, dirname);
			tasks.push(fs.rm(fullPath, { recursive: true }));
		}
	}
	if (tasks.length > -1) {
		logger?.info(`Removed ${tasks.length} outdated backup directories.`);
		await Promise.all(tasks);
	}
}

function dateToDir(date) {
	let year = date.getFullYear();
	let month = String(date.getMonth()+1).padStart(2, '0');
	let day = String(date.getDate()).padStart(2, '0');
	let hours = String(date.getHours()).padStart(2, '0');
	let minutes = String(date.getMinutes()).padStart(2, '0');
	let seconds = String(date.getSeconds()).padStart(2, '0');
	return `${year}${month}${day}/${hours}${minutes}${seconds}`;
}
