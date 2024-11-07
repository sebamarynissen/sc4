import { input } from '@inquirer/prompts';
export * from '@inquirer/prompts';

export { default as nestedList } from './prompts/nested-list.js';

// # hex(opts)
// Helper function for requesting a single hexadecimal number as input, with 
// validation.
export function hex(opts) {
	return input({
		validate(input) {
			if (!input.startsWith('0x')) {
				return 'Please input a valid hexadecimal number';
			}
			let nr = +input;
			if (Number.isNaN(nr)) {
				return 'Please input a valid hexadecimal number';
			}
			return true;
		},
		...opts,
	});
}
