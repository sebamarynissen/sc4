// # datpack-flow.ts
import * as prompts from '#cli/prompts';
import chalk from 'chalk';

export async function datpack() {

	let confirm = await prompts.confirm({
		message: `This action intentionally only datpacks plugins installed with sc4pac, but it will modify your plugins folder in place. If your plugins become corrupted, you can restore them by deleting the ${chalk.cyan('sc4pac-plugins-lock.json')} lockfile and then run sc4pac update again. Are you sure you want to continue?`,
		default: false,
		theme: {
			prefix: chalk.red('WARNING'),
		},
	});
	if (!confirm) return;

	let directory = process.env.SC4_PLUGINS as string;
	let useFolder = await prompts.confirm({
		message: `Is this the plugins folder to datpack? ${chalk.cyan(directory)}`,
		default: true,
	});
	if (!useFolder) {
		directory = await prompts.fileSelector({
			message: 'Select the folder to datpack',
			basePath: process.cwd(),
			type: 'directory',
			filter: info => info.isDirectory(),
		});
	}

	// Ask for the limit.
	let limit = await prompts.number({
		message: 'What is the minimum amount of files a plugin should contain before being datpacked?',
		default: 10,
	});
	return [directory, { limit }];

}
