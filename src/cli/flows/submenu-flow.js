// # submenu.js
import path from 'node:path';
import * as prompts from '#cli/prompts';

// # submenu()
// Contains the interactive flow for getting the options to pass to the submenu 
// patch command.
export async function submenu() {

	// If the exe was called with a bunch of files, we're going to use those 
	// files.
	let directory = await prompts.file({
		argv: true,
		basePath: process.cwd(),
		message: 'Select the directory to scan',
		type: 'directory',
		validate(info) {
			if (info.isDirectory()) return true;
			let ext = path.extname(info.path);
			return /^\.(dat|sc4.*)$/.test(ext);
		},
	});

	// Now ask what menu the items need to be added to.
	let menu = await prompts.menu({
		message: 'What menu do the items need to be added to?',
	});

	// Ask where to save the patch. This is a bit difficult because we need to 
	// figure out the base directory based on the files. We'll just pick the 
	// first one.
	let output = await prompts.input({
		message: `Where do you want to save the patch (relative to ${directory})?`,
		default: './submenu_patch.dat',
	});
	output = path.resolve(directory, output);
	return [[directory], {
		menu: +menu,
		output,
	}];

}
