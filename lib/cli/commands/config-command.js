// # config-command.js
import fs from 'node:fs';
import { parse } from 'yaml';
import configModule from '#cli/config.js';
import * as prompts from '#cli/prompts';

// # config()
// The command to let the user modify the configuration file manually.
export async function config() {
	let modifiedConfig = await prompts.editor({
		message: 'Modify, save and close the file to edit the config.',
		default: fs.readFileSync(configModule.path),
		postfix: 'yaml',
		validate(config) {
			try {
				parse(config);
			} catch (e) {
				return e.message;
			}
			return true;
		},
	});
	let parsed = parse(modifiedConfig);
	configModule.set(parsed);
}
