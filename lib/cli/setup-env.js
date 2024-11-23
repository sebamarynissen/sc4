// # ensure-installation.js
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import ora from 'ora';
import { Glob } from 'glob';
import chalk from 'chalk';
import * as prompts from '#cli/prompts';
import config from './config.js';

// List of possible base directories to search for installation, plugins and 
// regions.
const installationPaths = [
	'/Program Files (x86)/**/*SimCity 4*/',
	'/Program Files/**/*SimCity 4*/',
	'/GOG Games/**/*SimCity 4*/',
	'/Games/**/*SimCity 4*/',
	'/Users/*/Games/**/*SimCity 4*/',
];
const pluginPaths = [
	path.join(os.homedir(), 'Documents/SimCity 4/Plugins/'),
];
const regionPaths = [
	path.join(os.homedir(), 'Documents/SimCity 4/Regions/'),
];

// # setup()
// This function ensures that the environment variables for the various folders 
// are properly set. If environment variables are not found, then we look it up 
// in the config file, and if not found there, then we look it up in paths we 
// expect it to find in.
export default async function setup() {
	if (!process.env.SC4_INSTALLATION) {
		process.env.SC4_INSTALLATION = await ensureInstallation();
	}
	if (!process.env.SC4_PLUGINS) {
		process.env.SC4_PLUGINS = await ensureFolder('plugins', pluginPaths);
	}
	if (!process.env.SC4_REGIONS) {
		process.env.SC4_REGIONS = await ensureFolder('regions', regionPaths);
	}
}

// # ensureInstallation()
// Ensures that a SimCity 4 installation folder is set in the configuration. It 
// will look in a few commonly known installation folders, and if it can't find 
// it, it will prompt the user for it.
async function ensureInstallation() {

	// If the installation folder is already set in the config, use that one.
	let installation = config.get('folders.installation');
	if (installation) return installation;

	// If the installation folder has not been set yet, then start looking for 
	// it.
	let spinner = ora('Searching for SimCity 4 installation folder...').start();
	let folder = await findResourceFile();
	if (folder) {
		spinner.succeed(`SimCity 4 Installation folder found (${folder})`);
		config.set('folders.installation', folder);
		return folder;
	}

	// If we didn't find a SimCity 4 installation, we'll ask the user to locate 
	// it.
	spinner.fail('SimCity 4 installation folder not found');
	folder = await choose('installation');
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
async function choose(name) {
	let folder = await prompts.input({
		message: `Enter your SimCity 4 ${name} folder`,
	});
	if (!folder) {
		folder = await prompts.fileSelector({
			message: `Locate your SimCity 4 ${name} folder`,
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

// # findResourceFile()
// Finds the SimCity 4 installation folder in a way that as soon as we have a 
// match, we quit.
async function findResourceFile() {
	let paths = installationPaths.map(path => `${path}SimCity_1.dat`);
	let glob = new Glob(paths, {
		nocase: true,
		absolute: true,
	});
	for await (let file of glob) {
		return path.dirname(file);
	}
	return null;
}

// # ensureFolder(name, paths)
async function ensureFolder(name, paths) {
	let folder = config.get(`folders.${name}`);
	if (folder) return folder;

	// If the folder has not been set in the config, search for it in the 
	// filesystem.
	let spinner = ora(`Searching for SimCity 4 ${name} folder...`).start();
	folder = await findFolder(paths);
	if (folder) {
		spinner.succeed(`SimCity 4 ${name} folder found (${folder})`);
		config.set(`folders.${name}`, folder);
		return folder;
	}

	// If we didn't find the plugins folder, ask the user to choose a folder.
	spinner.fail('SimCity 4 plugins folder not found');
	folder = await choose(name);
	while (!exists(folder)) {
		console.log(chalk.red(`${folder} does not exist.`));
		folder = await choose(name);
	}
	config.set(`folders.${name}`, folder);
	return folder;

}

// # findFolder(paths)
async function findFolder(paths) {
	let glob = new Glob(paths, {
		nocase: true,
		absolute: true,
	});
	for await (let dir of glob) {
		return dir;
	}
	return null;
}

// # exists(folder)
async function exists(folder) {
	return !!await fs.promises.stat(folder);
}
