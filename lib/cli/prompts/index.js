import input from '@inquirer/input';
export { default as fileSelector } from 'inquirer-file-selector';
export { default as input } from '@inquirer/input';
export { default as confirm } from '@inquirer/confirm';
export { default as number } from '@inquirer/number';
export { default as select } from '@inquirer/select';
export { default as checkbox, Separator } from '@inquirer/checkbox';
export { default as nestedList } from './nested-list.js';

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
