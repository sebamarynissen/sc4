// # create-submenu-patch.js
import createMenuPatch from 'sc4/api/create-submenu-patch.js';
import logger from '#cli/logger.js';

export async function submenu(globsOrFiles, options) {
	if (globsOrFiles.length === 0) globsOrFiles = ['.'];
	let { menu } = options;
	await createMenuPatch(+menu, globsOrFiles, {
		save: true,
		logger,
		output: options.output || './submenu_patch.dat',
		directory: options.directory,
		instance: +options.instance || undefined,
		recursive: options.recursive,
	});
}
