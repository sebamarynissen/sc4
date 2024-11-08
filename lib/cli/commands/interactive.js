// # interactive.js
import path from 'node:path';
import fs from 'node:fs';
import chalk from 'chalk';
import submenuCommand from './create-submenu-patch-command.js';
import { Menu } from './constants.js';
import * as prompts from '../prompts.js';

// The default command when the program is used without any options. In this 
// case we fire up an inquirer session to ask the user what they want to do. 
// This way, when hitting the .exe, something useful appears at leat.
export default async function interactive() {
	try {
		let i = 0;
		while (await start(i++));
	} catch (e) {
		console.error(e);
	}
}

// # start()
async function start(n) {
	let choices = [
		{
			name: 'Create a submenu patch',
			value: submenu,
		},
	];
	if (n === 0) {
		choices.push(new prompts.Separator());
		choices.push({ name: 'Quit', value: 'quit' });
	} else {
		choices.unshift(new prompts.Separator());
		choices.unshift({ name: 'Quit', value: 'quit' });
	}
	let action = await prompts.select({
		message: 'What do you want to do?',
		choices,
	});

	// Perform the action and then return to start. If we want to quit, return 
	// false to break the loop.
	if (action === 'quit') return false;
	await action();
	return true;

}

// Asks the submenu questions and then calls the command.
async function submenu() {
	let dir = process.cwd();
	let thisDir = await prompts.confirm({
		message: `Are the files located in this directory? ${chalk.cyan(dir)}`,
	});
	if (!thisDir) {
		dir = await prompts.fileSelector({
			message: 'Select the directory where the files are located',
			basePath: process.cwd(),
			type: 'file+directory',
			filter(info) {
				if (info.isDirectory()) return true;
				let ext = path.extname(info.path).toLowerCase();
				return ['.sc4lot', '.sc4desc', '.sc4model', '.dat'].includes(ext);
			},
		});
	}
	let info = await fs.promises.stat(dir);
	if (!info.isDirectory()) {
		dir = path.dirname(dir);
	}
	let menu = await prompts.nestedList({
		name: 'menu',
		message: 'What menu do the items need to be added to ?',
		type: 'list',
		pageSize: 15,
		choices: {
			...Menu,
			'Custom button id...': 'custom',
		},
	});
	if (menu === 'custom') {
		({ menu } = await prompts.hex({
			name: 'menu',
			message: 'Input a custom button id (e.g 0x5c43f355)',
		}));
		menu = +menu;
	}
	let output = await prompts.input({
		message: 'Where do you want to save the patch?',
		default: './submenu_patch.dat',
	});
	await submenuCommand(menu, '*.{dat,sc4*}', {
		output,
		directory: dir,
	});
}
