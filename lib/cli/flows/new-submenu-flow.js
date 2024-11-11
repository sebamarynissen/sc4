// # new-submenu-flow.js
import * as prompts from '#cli/prompts';
import path from 'node:path';

// # newSubmenu()
// The flow for getting the input needed for creating a new submenu button.
export async function newSubmenu() {
	let name = await prompts.input({
		message: 'What is the name of the submenu?',
		required: true,
	});
	let description = await prompts.input({
		message: 'Enter the description of the submenu:',
		default: '',
	});
	let parent = await prompts.menu({
		message: 'Select the parent menu',
	});
	let icon = await prompts.fileSelector({
		message: 'Select the icon to be used for the button',
		type: 'file',
		filter(info) {
			if (info.isDirectory()) return info;
			return path.extname(info.path) === '.png';
		},
	});
	let order = +await prompts.uint32({
		message: 'Enter the item order:',
		default: 0,
	});
	return [icon, { name, description, parent, order }];

}
