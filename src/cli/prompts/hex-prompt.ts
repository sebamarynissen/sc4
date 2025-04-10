// # hex-prompt.js
import input from '@inquirer/input';

type HexPromptOptions = Omit<Parameters<typeof input>[0], 'validate' | 'default'> & {
	default?: number;
};

// # hex(opts)
// Helper function for requesting a single hexadecimal number as input, with 
// validation.
export async function hex(opts: HexPromptOptions) {
	return +await input({
		validate(input) {
			if (!input.startsWith('0x')) {
				return 'Please input a valid hexadecimal number (prefixed with 0x)';
			}
			let nr = +input;
			if (Number.isNaN(nr)) {
				return 'Please input a valid hexadecimal number (prefixed with 0x)';
			}
			return true;
		},
		...opts,
		default: typeof opts.default === 'number' ? stringify(opts.default) : undefined,
	});
}

// # stringify(nr)
function stringify(nr: number) {
	return `0x${nr.toString(16)}`;
}
