// # interactive.js
import submenuCommand from './create-submenu-patch-command.js';
import { Menu } from './constants.js';
import * as prompts from '../prompts.js';

// The default command when the program is used without any options. In this 
// case we fire up an inquirer session to ask the user what they want to do. 
// This way, when hitting the .exe, something useful appears at leat.
export default async function interactive() {
	while (await start());
}

// # start()
async function start() {
	let action = await prompts.select({
		message: 'What do you want to do?',
		choices: [
			{
				name: 'Create a submenu patch',
				value: submenu,
			},
			new prompts.Separator(),
			{
				name: 'Quit',
				value: 'quit',
			},
		],
	});

	// Perform the action and then return to start. If we want to quit, return 
	// false to break the loop.
	if (action === 'quit') return false;
	await action();
	return true;

}

// Asks the submenu questions and then calls the command.
async function submenu() {
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
	await submenuCommand(menu, [], {
		output,
	});
}
