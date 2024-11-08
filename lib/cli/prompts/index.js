// # prompts/index.js
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import input from '@inquirer/input';
import { makeTheme } from '@inquirer/core';
import fileSelector from 'inquirer-file-selector';

// Re-export some prompts.
export { default as confirm } from '@inquirer/confirm';
export { default as number } from '@inquirer/number';
export { default as select } from '@inquirer/select';
export { default as checkbox, Separator } from '@inquirer/checkbox';
export { default as nestedList } from './nested-list.js';
export { input, fileSelector };

// # hex(opts)
// Helper function for requesting a single hexadecimal number as input, with 
// validation.
export function hex(opts) {
	return input({
		validate(input) {
			if (!input.startsWith('0x')) {
				return 'Please input a valid hexadecimal number';
			}
			let nr = +input;
			if (Number.isNaN(nr)) {
				return 'Please input a valid hexadecimal number';
			}
			return true;
		},
		...opts,
	});
}

// # city(opts)
// Helper function for selecting a .sc4 city file. We will do it intelligently: 
// if the current working directory contains .sc4 files, then we use that one. 
// Otherwise we open the regions folder.
const regions = path.resolve(
	process.env.HOMEPATH ?? '/',
	'Documents/SimCity 4/Regions',
);
export async function city(opts = {}) {

	// If the argv option is specified, then we check if this is a valid .sc4 
	// city. This allows dragging .sc4 files to the exe.
	let { argv, message = 'Select a city', ...rest } = opts;
	let theme = makeTheme(opts.theme);
	if (argv) {
		let [city] = process.argv.slice(2);
		if (city && path.extname(city) === '.sc4' && fs.existsSync(city)) {
			console.log(`${theme.prefix.done} ${message} ${theme.style.answer(city)}`);
			return city;
		}
	}

	// No city specified as argument, then ask the user to select it.
	let basePath = process.cwd();
	let files = await fs.promises.readdir(basePath);
	if (!files.some(file => path.extname(file) === '.sc4')) {
		if (fs.existsSync(regions)) {
			basePath = regions;
		}
	}
	return fileSelector({
		basePath,
		message,
		validate(info) {
			if (!info.isDirectory()) {
				return path.extname(info.path) === '.sc4';
			}
			return true;
		},
		...rest,
	});

}
