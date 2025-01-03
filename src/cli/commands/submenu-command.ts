// # create-submenu-patch.js
import { createSubmenuPatch } from 'sc4/plugins';
import logger from '#cli/logger.js';

type AddToSubmenuOptions = {
	menu: number;
	output: string;
	directory: string;
	instance?: number;
	recursive: boolean;
};

export async function submenu(
	globsOrFiles: string[],
	options: AddToSubmenuOptions,
) {
	if (globsOrFiles.length === 0) globsOrFiles = ['.'];
	let { menu } = options;
	await createSubmenuPatch({
		menu,
		files: globsOrFiles,
		save: true,
		logger,
		output: options.output || './submenu_patch.dat',
		directory: options.directory,
		instance: options.instance ?? undefined,
		recursive: options.recursive,
	});
}
