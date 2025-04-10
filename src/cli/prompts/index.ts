// # prompts/index.js
import path from 'node:path';
import fs from 'node:fs';
import { makeTheme } from '@inquirer/core';
import input from '@inquirer/input';
import confirm from '@inquirer/confirm';
import args from '#cli/args.js';
import { fileSelector } from './file-selector-prompt.js';

// Re-export some prompts.
export { default as number } from '@inquirer/number';
export { default as select } from '@inquirer/select';
export { default as editor } from '@inquirer/editor';
export { default as checkbox, Separator } from '@inquirer/checkbox';
export { default as nestedList } from './nested-list.js';
export * from './hex-prompt.js';
export * from './menu-prompt.js';
export { menuIcon } from './menu-icon-prompt.js';
export { input, fileSelector, confirm };

type Uint32PromptOptions = Omit<Parameters<typeof input>[0], 'default'> & {
	default?: number;
};

// # uint32(opts)
// Helper function for requesting a simple uint32 numerical value.
export async function uint32(opts: Uint32PromptOptions) {
	return +await input({
		validate(input) {
			let nr = +input;
			if (Number.isNaN(nr) || nr % 1 !== 0) {
				return 'Please enter a valid uint32 number';
			}
			if (nr < 0) return 'Please enter a positive number';
			let max = 2**32;
			if (nr >= max) return `Please enter a number smaller than ${max}`;
			return true;
		},
		...opts,
		default: typeof opts.default === 'number' ? String(opts.default) : undefined,
	});
}

// # city(opts)
// Helper function for selecting a .sc4 city file. We will do it intelligently: 
// if the current working directory contains .sc4 files, then we use that one. 
// Otherwise we open the regions folder.
export async function city(opts: any = {}) {

	// If the argv option is specified, then we check if this is a valid .sc4 
	// city. This allows dragging .sc4 files to the exe.
	let { argv, message = 'Select a city', ...rest } = opts;
	let theme = makeTheme(opts.theme)
	if (argv) {
		let [city] = args;
		if (city && path.extname(city) === '.sc4' && fs.existsSync(city)) {
			const prefix = theme.prefix as Exclude<typeof theme.prefix, string>;
			console.log(`${prefix.done} ${message} ${theme.style.answer(city)}`);
			return city;
		}
	}

	// No city specified as argument, then ask the user to select it.
	let basePath = process.cwd();
	let files = await fs.promises.readdir(basePath);
	if (!files.some(file => path.extname(file) === '.sc4')) {
		const regions = process.env.SC4_REGIONS!;
		if (fs.existsSync(regions)) {
			basePath = regions;
		}
	}
	return fileSelector({
		basePath,
		message,
		filter(info) {
			if (!info.isDirectory()) {
				return path.extname(info.path) === '.sc4';
			}
			return true;
		},
		...rest,
	});

}

type FilePromptOptions = {
	argv?: string[];
	multi?: boolean;
} & Parameters<typeof fileSelector>[0];

// # selectFiles(opts)
// Helper prompt for selecting multiple files or directories.
async function selectFiles(opts: FilePromptOptions) {

	// First of all, if it's possible that the files have been specified in the 
	// arguments, if that's the case, no need to select files, but we'll show 
	// information about what was selected.
	let { argv, message, multi = true, ...rest } = opts;
	if (argv && args.length > 0) {
		let theme = makeTheme(opts.theme);
		for (let file of args) {
			const prefix = theme.prefix as Exclude<typeof theme.prefix, string>;
			console.log(`${prefix.done} ${message} ${theme.style.answer(file)}`);
		}
		return multi ? [...args] : args[0];
	}

	// If not, then we ask the user to select the files manually.
	let more = multi;
	let files = new Set();
	do {
		let file = await fileSelector({ message, ...rest });
		files.add(file);
		if (multi) {
			more = await confirm({
				message: 'Do you want to select more?',
				default: false,
			});
		}
	} while (more);
	return multi ? [...files] : [...files][0];

}

// # files(opts)
// Helper prompt for selecting multiple files or directories.
export async function files(opts: Omit<FilePromptOptions, 'multi'>) {
	return await selectFiles({
		multi: true,
		...opts,
	}) as string[];
}

// # file(opts)
// Same as files, but for a single file.
export async function file(opts: Omit<FilePromptOptions, 'multi'>) {
	return await selectFiles({
		multi: false,
		...opts,
	}) as string;
}
