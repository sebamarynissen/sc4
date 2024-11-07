// # nested-list.js
import { select } from '@inquirer/prompts';

const kUp = Symbol('up');
export default async function nestedList(config) {
	let stack = [];
	let menu = config;
	while (typeof menu === 'object') {
		let prev = menu;
		let parsed = convert(menu);
		menu = await select(parsed);
		if (menu === kUp) {
			menu = stack.pop();
		} else {
			stack.push(prev);
		}
	}
	return menu;
}

function convert(config) {
	let { choices, ...rest } = config;
	choices = Object.entries(choices).map(([key, value]) => {
		if (typeof value === 'object') {
			return {
				name: `${key}...`,
				value: {
					name: 'menu',
					message: key,
					choices: {
						...value,
						'^Up': kUp,
					},
				},
			};
		} else {
			return { name: key, value };
		}
	});
	return {
		...rest,
		choices,
	};
}
