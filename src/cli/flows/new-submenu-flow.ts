// # new-submenu-flow.ts
import * as prompts from '../prompts/index.js';
import { type newSubmenu as command } from '#cli/commands';

// # newSubmenu()
// The flow for getting the input needed for creating a new submenu button.
export async function newSubmenu(): Promise<Parameters<typeof command>> {
	let name = await prompts.input({
		message: 'What is the name of the submenu?',
		required: true,
	});

	// If the description is left empty, we have to set it to "undefined" so 
	// that the default description is used.
	let description: string | undefined = await prompts.input({
		message: 'Enter the description of the submenu (leave open to use the default)',
		default: '',
	});
	if (description.trim().length === 0) {
		description = undefined;
	}
	let parent = await prompts.menu({
		message: 'Select the parent menu',
	});
	let icon = await prompts.menuIcon({
		message: 'Select the icon to be used for the button:',
	});
	let order = await prompts.uint32({
		message: 'Enter the item order: (number between -2,147,483,648 and 2,147,483,647):',
		default: 0,
	});
	return [icon, { name, description, parent, order }];

}
