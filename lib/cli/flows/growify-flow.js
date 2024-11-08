// # growify-flow.js
import * as prompts from '#cli/prompts';
import path from 'node:path';
import chalk from 'chalk';

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

	// Request whether to force override the city. Note that 
	let force = await prompts.confirm({
		message: [
			`Do you want to override "${path.basename(city)}?"`,
			chalk.yellow(`Don't do this if you have backup yet!`.toUpperCase()),
		].join(' '),
		default: false,
	});
	let output = city;
	if (!force) {
		let dir = path.dirname(city);
		output = await prompts.input({
			message: [
				'Where should I save your city?',
				`Path is relative to "${dir}".`,
			].join(' '),
			default: 'GROWIFIED-'+path.basename(output),
		});
		output = path.resolve(dir, output);
		let ok = await prompts.confirm({
			message: `Saving to ${chalk.magenta(output)}, is that ok?`,
		});
		if (!ok) return false;
		options.output = output;
	} else {
		options.force = true;
	}
	return [city, options];

}

const ZoneTypes = {
	residential: ['High', 'Medium', 'Low'],
	commercial: ['High', 'Medium', 'Low'],
	industrial: ['High', 'Medium'],
};
