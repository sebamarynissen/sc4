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
	process.env.SC4_INSTALLATION ??= await ensureInstallation();
	process.env.SC4_PLUGINS ??= await ensureFolder('plugins', pluginPaths);
	process.env.SC4_REGIONS ??= await ensureFolder('regions', regionPaths);
}

// # ensureInstallation()
// Ensures that a SimCity 4 installation folder is set in the configuration. It 
// will look in a few commonly known installation folders, and if it can't find 
// it, it will prompt the user for it.
async function ensureInstallation() {

	// If the installation folder is already set in the config, use that one. 
	// However, if it is set to "false", we default to the current working 
	// directory.
	let installation = config.get('folders.installation');
	if (installation) return installation;
	else if (installation === false) return process.cwd();

	// If the installation folder has not been set yet, then start looking for 
	// it.
	let spinner = ora('Searching for SimCity 4 installation folder...').start();
	let folder = await findResourceFile();
	if (folder) {
		spinner.succeed(`SimCity 4 installation folder found (${folder})`);
		config.set('folders.installation', folder);
		return folder;
	}

	// If this is not an interactive terminal, we can't prompt the user of 
	// course.
	if (!process.stdin.isTTY) return process.cwd();

	// If we didn't find a SimCity 4 installation folder, then we'll notify the 
	// user that they might need to locate it themselves, but first we'll ask if 
	// they even have SimCity 4 installed.
	spinner.fail('SimCity 4 installation folder not found');
	let withInstallation = await prompts.confirm({
		message: 'Some commands need access to the original SimCity 4 resource files, like SimCity_1.dat. Would you like to locate the SimCity 4 installation folder yourself? Choose "no" if you want to continue without an installation folder, which might cause some commands to not function properly.',
	});
	if (!withInstallation) {
		config.set('folders.installation', false);
		return process.cwd();
	}

	// If we didn't find a SimCity 4 installation, we'll ask the user to locate 
	// it.
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

	// If a folder was specified, but it does no longer exist, then we have to 
	// look for it again, so don't return early.
	if (folder) {
		try {
			await fs.promises.stat(folder);
			return folder;
		} catch (e) {
			if (e.code !== 'ENOENT') {
				throw e;
			}
		}
	} else if (folder === false) return process.cwd();

	// If the folder has not been set in the config, search for it in the 
	// filesystem.
	let spinner = ora(`Searching for SimCity 4 ${name} folder...`).start();
	folder = await findFolder(paths);
	if (folder) {
		spinner.succeed(`SimCity 4 ${name} folder found (${folder})`);
		config.set(`folders.${name}`, folder);
		return folder;
	}
	spinner.fail(`SimCity 4 ${name} folder not found`);

	// If this is not an interactive terminal, we can't continue.
	if (!process.stdin.isTTY) return process.cwd();

	// If we didn't find the folder we're looking for, ask the user whether they 
	// want to select one themselves.
	let withFolder = await prompts.confirm({
		message: `Some commands look for ${name} in a certain folder. Would you like to select this folder yourself? If you choose "no", you will need to use absolute paths for your ${name}.`,
	});
	if (!withFolder) {
		config.set(`folders.${name}`, false);
		return process.cwd();
	}

	// If we didn't find the plugins folder, ask the user to choose a folder.
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
