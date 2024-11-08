// # create-submenu-patch.js
import createMenuPatch from 'sc4/api/create-submenu-patch.js';

export default async function createSubmenuPatchCommand(menu, globs, options) {
	if (globs.length === 0) globs = ['*.{dat,sc4*}'];
	await createMenuPatch(+menu, globs, {
		save: true,
		output: options.output,
		directory: options.directory,
		instance: +options.instance || undefined,
	});
}
