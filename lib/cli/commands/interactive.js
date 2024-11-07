// # interactive.js
import inquirer from 'inquirer';
import submenuCommand from './create-submenu-patch-command.js';
import { Menu } from './constants.js';

// The default command when the program is used without any options. In this 
// case we fire up an inquirer session to ask the user what they want to do. 
// This way, when hitting the .exe, something useful appears at leat.
export default async function interactive() {
	let { action } = await inquirer.prompt({
		name: 'action',
		type: 'list',
		message: 'What do you want to do?',
		choices: [
			// {
			// 	name: 'Growify buildings',
			// 	value: 'growify',
			// 	disabled: true,
			// },
			// {
			// 	name: 'Make buildings historical',
			// 	value: 'historical',
			// 	disabled: true,
			// },
			// {
			// 	name: 'Generate an optimal pipe layout',
			// 	value: 'pipes',
			// 	disabled: true,
			// },
			{
				name: 'Create a submenu patch',
				value: 'submenu',
			},
			new inquirer.Separator(),
			{
				name: 'Quit',
				value: 'quit',
			},
		],
	});

	if (action === 'quit') return;

	if (action === 'submenu') return await submenu();

}

// Creates the submenu questions.
const kUp = Symbol('up');
const kParent = Symbol('parent');
async function submenu() {

	let menu = {
		name: 'menu',
		message: 'What menu do the items need to be added to ?',
		type: 'list',
		pageSize: 15,
		choices: {
			...Menu,
			'Custom button id...': 'custom',
		},
	};
	let stack = [];
	while (typeof menu === 'object') {
		let prev = menu;
		let parsed = objectToChoices(menu);
		({ menu } = await inquirer.prompt(parsed));
		if (menu === kUp) {
			menu = stack.pop();
		} else {
			stack.push(prev);
		}
	}
	if (menu === 'custom') {
		let answer = await inquirer.prompt({
			name: 'menu',
			type: 'input',
			message: 'Input a custom button id (e.g 0x5c43f355)',
		});
		menu = +answer.menu;
	}
	// await submenuCommand(menu, [], {});
}

function objectToChoices(menu) {
	let { choices, ...rest } = menu;
	choices = Object.entries(choices).map(([key, value]) => {
		if (typeof value === 'object') {
			value[kParent] = menu;
			return {
				name: `${key}...`,
				value: {
					name: 'menu',
					message: key,
					type: 'list',
					choices: {
						...value,
						'^Up': kUp,
					},
				},
			};
		} else {
			return { name: key, value };
		}
	});
	return {
		...rest,
		choices,
	};
}
