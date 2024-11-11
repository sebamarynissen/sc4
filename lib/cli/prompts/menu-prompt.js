// # menu-prompt.js
import nestedList from './nested-list.js';
import { hex } from './hex-prompt.js';

// # menu()
// A custom prompt that allows the user to select a certain menu. This is useful 
// when adding lots to a menu, or when creating new submenus. Note that we will 
// parse the existing menu items from the config as well!
export async function menu(opts = {}) {
	let { message } = opts;
	let menu = await nestedList({
		message,
		pageSize: 15,
		choices: {
			...Menu,
			'Custom button id...': 'custom',
		},
	});
	if (menu === 'custom') {
		menu = +await hex({
			name: 'menu',
			message: 'Input a custom button id (e.g 0x5c43f355)',
		});
	}
	return menu;
}

const rootKey = '[root]';
const Menu = {
	Flora: 0x4a22ea06,
	RCI: {
		Residential: {
			[rootKey]: 0x29920899,
			R$: 0x93DADFE9,
			R$$: 0x984E5034,
			R$$$: 0x9F83F133,
		},
		Commercial: {
			[rootKey]: 0xa998af42,
			CS$: 0x11BF1CA9,
			CS$$: 0x24C43253,
			CS$$$: 0x9BDEFE2B,
			CO$$: 0xA7FF7CF0,
			CO$$$: 0xE27B7EF6,
		},
		Industrial: {
			[rootKey]: 0xc998af00,
			Farms: 0xC220B7D8,
			'Dirty Industry': 0x62D82695,
			'Manufacturing Industry': 0x68B3E5FD,
			'High-Tech Industry': 0x954E20FE,
		},
	},
	Transport: {
		Road: 0x6999bf56,
		Highway: {
			[rootKey]: 0x31,
			Signage: 0x83E040BB,
		},
		Rail: {
			[rootKey]: 0x29,
			'Passenger Rail': 0x35380C75,
			'Freight Rail Stations': 0x3557F0A1,
			Yards: 0x39BA25C7,
			'Hybrid Railway': 0x2B294CC2,
			Monorail: 0x3A1D9854,
		},
		'Misc. Transit': {
			[rootKey]: 0x299237bf,
			Bus: 0x1FDDE184,
			GLR: 0x26B51B28,
			'El-Rail': 0x244F77E1,
			Subway: 0x231A97D3,
			'Multi-modal Stations': 0x322C7959,
			Parking: 0x217B6C35,
		},
		Airport: 0xe99234b3,
		'Water Transit': {
			[rootKey]: 0xa99234a6,
			'Seaports and Ferry Terminals': 0x07047B22,
			Canals: 0x03C6629C,
			Seawalls: 0x1CD18678,
			Waterfront: 0x84D42CD6,
		},
	},
	Utilities: {
		Power: {
			[rootKey]: 0x35,
			'Dirty Energy': 0x4B465151,
			'Clean Energy': 0xCDE0316B,
			'Miscellaneous Power Utilities': 0xD013F32D,
		},
		Water: 0x39,
		Garbage: 0x40,
	},
	Civics: {
		Police: {
			[rootKey]: 0x37,
			Small: 0x65D88585,
			Large: 0x7D6DC8BC,
			Deluxe: 0x8157CA0E,
			Military: 0x8BA49621,
		},
		Fire: 0x38,
		Education: {
			[rootKey]: 0x42,
			'Elementary Schools': 0x9FE5C428,
			'High Schools': 0xA08063D0,
			'Higher Education': 0xAC706063,
			'Libraries and Museums': 0xAEDD9FAA,
		},
		Health: {
			[rootKey]: 0x89dd5405,
			Small: 0xB1F7AC5B,
			Medium: 0xB7B594D6,
			Large: 0xBC251B69,
		},
		Landmark: {
			[rootKey]: 0x09930709,
			Government: 0x9FAF7A3B,
			'Churches and Cemeteries': 0x26EB3057,
			Entertainment: 0xBE9FDA0C,
		},
		Reward: 0x34,
		Parks: {
			[rootKey]: 0x3,
			'Green Spaces': 0xBF776D40,
			Plazas: 0xEB75882C,
			'Sports Grounds': 0xCE21DBEB,
			'Paths and Modular Parks': 0xDEFFD960,
			'Embankments and Retaining Walls': 0xBB531946,
			Fillers: 0xF034265C,
		},
	},
};
