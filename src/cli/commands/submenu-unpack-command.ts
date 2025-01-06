// # submenu-unpack-command.ts
import path from 'node:path';
import logger from '#cli/logger.js';
import { unpackSubmenu } from 'sc4/plugins';

type SubmenuUnpackCommandOptions = {
	patterns?: string[];
	output?: string;
};

export async function submenuUnpack(
	directory: string = '.',
	options: SubmenuUnpackCommandOptions,
) {
	directory = path.resolve(process.cwd(), directory);
	let output = path.resolve(process.cwd(), options.output ?? '.');
	await unpackSubmenu({
		patterns: options.patterns,
		directory,
		output,
		logger,
	});
}
