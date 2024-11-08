// # historical-flow.js
import * as prompts from '#cli/prompts';

// # historical()
// The questions to be asked when making buildings in a city historical.
export async function historical() {

	// Prompt for the city, but default to what was specified in the arguments.
	let city = await prompts.city({
		argv: true,
		message: 'Select the city to make historical',
	});

	let types = await prompts.checkbox({
		message: 'What type(s) of buildings do you want to make historical?',
		choices: [
			{
				name: 'Residential',
				value: 'residential',
				checked: true,
			},
			{
				name: 'Commercial',
				value: 'commercial',
				checked: true,
			},
			{
				name: 'Industrial',
				value: 'industrial',
				checked: true,
			},
			{
				name: 'Agricultural',
				value: 'agricultural',
				checked: true,
			},
		],
	});
	if (types.length === 0) return false;
	let options = Object.fromEntries(types.map(type => [type, true]));
	return [city, options];

}
