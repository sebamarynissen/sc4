// # create-submenu-patch.js
import path from 'node:path';
import { glob } from 'glob';
import createMenuPatch from 'sc4/api/create-submenu-patch.js';

export default async function createSubmenuPatchCommand(menu, files, options) {
	if (files.length === 0) files = ['*.{dat,sc4*}'];
	let fullPaths = glob
		.globSync(files, { nodir: true })
		.map(file => path.resolve(process.cwd(), file));
	await createMenuPatch(+menu, fullPaths, {
		save: true,
		output: options.output,
		instance: +options.instance || undefined,
	});
}
