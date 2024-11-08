// # interactive.js
import * as commands from '../commands/index.js';
import * as prompts from '../prompts.js';
import * as flows from '../flows/index.js';

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
			async value() {
				await commands.submenu(...await flows.submenu());
			},
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
