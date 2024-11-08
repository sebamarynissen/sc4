// # growify-flow.js
import * as prompts from '#cli/prompts';

// # growify()
// The questions to be asked for the growify command in the interacive flow.
export async function growify() {

	// Prompt for the city. However, if the sc4.exe tool was called with the 
	// .sc4 file as first argument don't need this. This will allow users to do 
	// "Open with sc4.exe".
	let city = await prompts.city({
		argv: true,
		message: 'Select the city to growify',
	});

	let types = await prompts.checkbox({
		message: 'What type(s) of buildings fo you want to growify?',
		required: true,
		choices: [{
			name: 'Residential',
			value: 'residential',
			checked: true,
		}, {
			name: 'Commercial',
			value: 'commercial',
			checked: true,
		}, {
			name: 'Industrial',
			value: 'industrial',
			checked: true,
		}, {
			name: 'Agricultural',
			value: 'agricultural',
			checked: true,
		}],
	});

	// Request the density to be used for each rci type.
	let options = {};
	for (let type of types) {
		let density = ZoneTypes[type];
		if (density) {
			options[type] = await prompts.select({
				message: `What zone should the ${type} buildings become?`,
				choices: density,
			});
		} else {
			options[type] = true;
		}
	}

	// Buildings are to be made historical by default.
	options.historical = await prompts.confirm({
		message: 'Do you want the growified buildings to be historical?',
		default: true,
	});
	options.output = city;
	return [city, options];

}

const ZoneTypes = {
	residential: ['High', 'Medium', 'Low'],
	commercial: ['High', 'Medium', 'Low'],
	industrial: ['High', 'Medium'],
};
