// # submenu.js
import path from 'node:path';
import fs from 'node:fs';
import * as prompts from '#cli/prompts';

// # submenu()
// Contains the interactive flow for getting the options to pass to the submenu 
// patch command.
export async function submenu() {

	// If the exe was called with a bunch of files, we're going to use those 
	// files.
	let files = await prompts.files({
		argv: true,
		basePath: process.cwd(),
		message: 'Select the file or directory to scan',
		type: 'file+directory',
		validate(info) {
			if (info.isDirectory()) return true;
			let ext = path.extname(info.path);
			return /^\.(dat|sc4.*)$/.test(ext);
		},
	});

	// Check if any of the files specified is a directory. If this is the case, 
	// we'll ask whether to recursively scan the directories or not.
	let hasDirectory = files.some(file => {
		let info = fs.statSync(file);
		return info.isDirectory();
	});
	let recursive = false;
	if (hasDirectory) {
		recursive = await prompts.confirm({
			message: 'Do you want to recursively scan the folders?',
			default: false,
		});
	}

	// Now ask what menu the items need to be added to.
	let menu = await prompts.menu({
		message: 'What menu do the items need to be added to?',
	});

	// Ask where to save the patch. This is a bit difficult because we need to 
	// figure out the base directory based on the files. We'll just pick the 
	// first one.
	let outputDir;
	let [first] = files;
	let info = fs.statSync(first);
	if (info.isDirectory()) {
		outputDir = first;
	} else {
		outputDir = path.dirname(first);
	}
	let output = await prompts.input({
		message: `Where do you want to save the patch (relative to ${outputDir})?`,
		default: './submenu_patch.dat',
	});
	output = path.resolve(outputDir, output);
	return [files, {
		menu: +menu,
		output,
		recursive,
	}];

}
