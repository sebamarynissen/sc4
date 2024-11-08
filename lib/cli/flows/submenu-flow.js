// # submenu.js
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import * as prompts from '#cli/prompts';

// # submenu()
// Contains the interactive flow for getting the options to pass to the submenu 
// patch command.
export default async function submenu() {
	let dir = process.cwd();
	let thisDir = await prompts.confirm({
		message: `Are the files located in this directory? ${chalk.cyan(dir)}`,
	});
	if (!thisDir) {
		dir = await prompts.fileSelector({
			message: 'Select the directory where the files are located',
			basePath: process.cwd(),
			type: 'file+directory',
			filter(info) {
				if (info.isDirectory()) return true;
				let ext = path.extname(info.path).toLowerCase();
				return ['.sc4lot', '.sc4desc', '.sc4model', '.dat'].includes(ext);
			},
		});
	}
	let info = await fs.promises.stat(dir);
	if (!info.isDirectory()) {
		dir = path.dirname(dir);
	}
	let menu = await prompts.nestedList({
		name: 'menu',
		message: 'What menu do the items need to be added to ?',
		type: 'list',
		pageSize: 15,
		choices: {
			...Menu,
			'Custom button id...': 'custom',
		},
	});
	if (menu === 'custom') {
		({ menu } = await prompts.hex({
			name: 'menu',
			message: 'Input a custom button id (e.g 0x5c43f355)',
		}));
		menu = +menu;
	}
	let output = await prompts.input({
		message: 'Where do you want to save the patch?',
		default: './submenu_patch.dat',
	});
	return [menu, '*.{dat,sc4*}', { output, directory: dir }];
}

const Menu = {
	Residential: {
		R$: 0x93DADFE9,
		R$$: 0x984E5034,
		R$$$: 0x9F83F133,
	},
	Commercial: {
		CS$: 0x11BF1CA9,
		CS$$: 0x24C43253,
		CS$$$: 0x9BDEFE2B,
		CO$$: 0xA7FF7CF0,
		CO$$$: 0xE27B7EF6,
	},
	Industrial: {
		Farms: 0xC220B7D8,
		'Dirty Industry': 0x62D82695,
		'Manufacturing Industry': 0x68B3E5FD,
		'High-Tech Industry': 0x954E20FE,
	},
	Highway: {
		Signage: 0x83E040BB,
	},
	Rail: {
		'Passenger Rail': 0x35380C75,
		'Freight Rail Stations': 0x3557F0A1,
		Yards: 0x39BA25C7,
		'Hybrid Railway': 0x2B294CC2,
		Monorail: 0x3A1D9854,
	},
	'Misc. Transit': {
		Bus: 0x1FDDE184,
		GLR: 0x26B51B28,
		'El-Rail': 0x244F77E1,
		Subway: 0x231A97D3,
		'Multi-modal Stations': 0x322C7959,
		Parking: 0x217B6C35,
	},
	'Water Transit': {
		'Seaports and Ferry Terminals': 0x07047B22,
		Canals: 0x03C6629C,
		Seawalls: 0x1CD18678,
		Waterfront: 0x84D42CD6,
	},
	Power: {
		'Dirty Energy': 0x4B465151,
		'Clean Energy': 0xCDE0316B,
		'Miscellaneous Power Utilities': 0xD013F32D,
	},
	Police: {
		Small: 0x65D88585,
		Large: 0x7D6DC8BC,
		Deluxe: 0x8157CA0E,
		Military: 0x8BA49621,
	},
	Education: {
		'Elementary Schools': 0x9FE5C428,
		'High Schools': 0xA08063D0,
		'Higher Education': 0xAC706063,
		'Libraries and Museums': 0xAEDD9FAA,
	},
	Health: {
		Small: 0xB1F7AC5B,
		Medium: 0xB7B594D6,
		Large: 0xBC251B69,
	},
	Landmark: {
		Government: 0x9FAF7A3B,
		'Churches and Cemeteries': 0x26EB3057,
		Entertainment: 0xBE9FDA0C,
	},
	Parks: {
		'Green Spaces': 0xBF776D40,
		Plazas: 0xEB75882C,
		'Sports Grounds': 0xCE21DBEB,
		'Paths and Modular Parks': 0xDEFFD960,
		'Embankments and Retaining Walls': 0xBB531946,
		Fillers: 0xF034265C,
	},
};
