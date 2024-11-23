// # ensure-installation.js
import path from 'node:path';
import fs from 'node:fs';
import ora from 'ora';
import { Glob } from 'glob';
import chalk from 'chalk';
import * as prompts from '#cli/prompts';
import config from './config.js';

// Ensures that a SimCity 4 installation folder is set in the configuration. It 
// will look in a few commonly known installation folders, and if it can't find 
// it, it will prompt the user for it.
export default async function ensureInstallation() {

	// If the installation folder is already set in the config, use that one.
	let installation = config.get('folders.installation');
	if (installation) return installation;

	// If the installation folder has not been set yet, then start looking for 
	// it.
	let spinner = ora('Searching for SimCity 4 installation folder...').start();
	let folder = await findFolder();
	if (folder) {
		spinner.succeed(`Installation folder found (${folder})`);
		config.set('folders.installation', folder);
		return folder;
	}

	// If we didn't find a SimCity 4 installation, we'll ask the user to locate 
	// it.
	spinner.fail('SimCity 4 installation folder not found');
	folder = await choose();
	while (!await isValidInstallation(folder)) {
		console.log(chalk.red(`SimCity_1.dat was not found inside ${folder}!`));
		folder = await choose();
	}
	config.set('folders.installation', folder);
	return folder;

}

// # choose()
// The function that allows the user to choose their installation folder. We'll 
// make sure that SimCity_1.dat can be found here in a loop.
async function choose() {
	let folder = await prompts.input({
		message: 'Enter your SimCity 4 installation folder',
	});
	if (!folder) {
		folder = await prompts.fileSelector({
			message: 'Locate your SimCity 4 installation folder',
			type: 'directory',
			filter: info => info.isDirectory(),
		});
	}
	return folder;
}

// # isValidInstallation(folder)
async function isValidInstallation(folder) {
	try {
		let fullPath = path.resolve(folder, 'SimCity_1.dat');
		return !!await fs.promises.stat(fullPath);
	} catch (e) {
		if (e.code === 'ENOENT') return false;
		throw e;
	}
}

// # findFolder()
// Finds the SimCity 4 installation folder in a way that as soon as we have a 
// match, we quit.
async function findFolder() {
	let paths = searchPaths.map(path => `${path}SimCity_1.dat`);
	let glob = new Glob(paths, {
		nocase: true,
		absolute: true,
	});
	for await (let file of glob) {
		return path.dirname(file);
	}
	return null;
}

// List of possible base directories to search
const searchPaths = [
	'/Program Files (x86)/**/*SimCity 4*/',
	'/Program Files/**/*SimCity 4*/',
	'/GOG Games/**/*SimCity 4*/',
	'/Games/**/*SimCity 4*/',
	'/Users/*/Games/**/*SimCity 4*/',
];
