// # pipes-flow.js
import * as prompts from '#cli/prompts';

// # pipes()
// Asks the questions needed to generate an optimal pipe layout.
export async function pipes() {
	let city = await prompts.city({
		argv: true,
		message: 'Select the city to generate a pipe layout for',
	});
	return [city];
}
