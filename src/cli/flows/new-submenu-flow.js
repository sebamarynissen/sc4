// # new-submenu-flow.js
import * as prompts from '#cli/prompts';

// # newSubmenu()
// The flow for getting the input needed for creating a new submenu button.
export async function newSubmenu() {
	let name = await prompts.input({
		message: 'What is the name of the submenu?',
		required: true,
	});

	// If the description is left empty, we have to set it to "undefined" so 
	// that the default description is used.
	let description = await prompts.input({
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
	let order = +await prompts.uint32({
		message: 'Enter the item order:',
		default: 0,
	});
	return [icon, { name, description, parent, order }];

}
