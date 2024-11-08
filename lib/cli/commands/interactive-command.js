// # interactive.js
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import * as commands from '#cli/commands';
import * as prompts from '#cli/prompts';
import * as flows from '#cli/flows';
import args from '#cli/args.js';

// The default command when the program is used without any options. In this 
// case we fire up an inquirer session to ask the user what they want to do. 
// This way, when hitting the .exe, something useful appears at leat.
export async function interactive() {
	let error = true;
	while (error) {
		error = null;
		try {
			let i = 0;
			while (await start(i++));
		} catch (e) {
			if (e.name !== 'ExitPromptError') {
				console.error(chalk.red('ERROR'), e);
				error = e;
			} else {
				exit();
			}
		}
	}
}

// # start()
async function start(n) {

	// Default commands.
	let choices = [
		{
			name: 'Growify RCI',
			type: 'city',
			async value() {
				let args = await flows.growify();
				if (!args) return;
				await commands.growify(...args);
			},
		},
		{
			name: 'Make buildings historical',
			type: 'city',
			async value() {
				let args = await flows.historical();
				if (!args) return;
				await commands.historical(...args);
			},
		},
		{
			name: 'Create an optimal pipe layout',
			type: 'city',
			async value() {
				let args = await flows.pipes();
				if (!args) return;
				await commands.pipes(...args);
			},
		},
		{
			name: 'Create a submenu patch',
			async value() {
				await commands.submenu(...await flows.submenu());
			},
		},
	];

	// If the program was called with an existing SimCity 4 savegame, we'll 
	// limit the possible options shown to the city related commands.
	let message = 'What do you want to do?';
	let [file] = args;
	if (file && fs.existsSync(file) && path.extname(file) === '.sc4') {
		choices = choices.filter(choice => choice.type === 'city');
		message = `What do you want to do with ${chalk.cyan(path.basename(file))}?`;
	}

	if (n === 0) {
		choices.push(new prompts.Separator());
		choices.push({ name: 'Quit', value: 'quit' });
	} else {
		choices.unshift(new prompts.Separator());
		choices.unshift({ name: 'Quit', value: 'quit' });
	}
	let action = await prompts.select({ message, choices });

	// Perform the action and then return to start. If we want to quit, return 
	// false to break the loop.
	if (action === 'quit') {
		exit();
		return false;
	}
	await action();
	return true;

}

async function exit() {
	console.log(chalk.cyan('Bye'));
}
