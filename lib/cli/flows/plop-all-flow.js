// # plop-all-flow.js
import chalk from 'chalk';
import * as prompts from '#cli/prompts';
import parseList from '#cli/helpers/parse-list.js';

// # plopAll()
export async function plopAll() {

	// Ensure that the user is aware of the risks of running this command.
	let confirm = await prompts.confirm({
		message: `This command is highly experimental and meant for testing purposes. It must not be used on an established city. Do you want to continue?`,
		theme: {
			prefix: chalk.red('WARNING'),
		},
	});
	if (!confirm) return;

	// Cool, we'll continue now.
	let city = await prompts.city({
		argv: true,
		message: 'Select the city to plop the lots in. It is highly advised to pick an empty, flat city.',
	});

	// Ask for the folder patterns.
	let patterns = await prompts.input({
		message: `Enter the lots to use as glob patterns (e.g. **/*.sc4lot). If you're using sc4pac, you can also use the syntax "group:name", e.g. mattb325:*, diego-del-llano:432-park-avenue`,
		required: true,
	});
	patterns = parseList(patterns);

	let clear = await prompts.confirm({
		message: 'Do you want to clear the existing lots in the city?',
		default: false,
	});

	let bbox = await prompts.input({
		message: 'Enter the bounding box where to plop the lots as minX, minZ, maxX, maxZ. Leave this open for using the entire tile.',
	});
	return [city, patterns, { clear, bbox }];

}
