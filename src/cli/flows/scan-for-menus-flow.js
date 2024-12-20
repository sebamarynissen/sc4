// # scan-for-menus-flow.js
import chalk from 'chalk';
import * as prompts from '#cli/prompts';

// # scanForMenus()
export async function scanForMenus() {
	let plugins = process.env.SC4_PLUGINS;
	let useFolder = await prompts.confirm({
		message: `Is this the folder you want to scan? ${chalk.cyan(plugins)}`,
		default: true,
	});
	if (!useFolder) {
		plugins = await prompts.fileSelector({
			basePath: process.cwd(),
			type: 'directory',
			filter: info => info.isDirectory(),
		});
	}
	return [plugins];
}
