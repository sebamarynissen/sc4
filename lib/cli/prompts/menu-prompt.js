// # menu-prompt.js
import {
	createPrompt,
	isBackspaceKey,
	isDownKey,
	isEnterKey,
	isUpKey,
	makeTheme,
	useKeypress,
	useMemo,
	usePagination,
	usePrefix,
	useState,
} from '@inquirer/core';
import figures from '@inquirer/figures';
import config from '#cli/config.js';
import buildMenuTree from '#cli/helpers/build-menu-tree.js';
import { hex } from './hex-prompt.js';

// # menu()
// A custom prompt that allows the user to select a certain menu. This is useful 
// when adding lots to a menu, or when creating new submenus. Note that we will 
// parse the existing menu items from the config as well!
export async function menu(opts = {}) {
	const { message } = opts;
	let menu = await menuPrompt({
		message,
		menu: {
			...buildMenuOptions(),
			['Custom button id...']: 'custom',
		},
		pageSize: 15,
	});
	if (menu === 'custom') {
		menu = +await hex({
			message: 'Input a custom button id (e.g 0x5c43f355)',
		});
	}
	return menu;
}

const rootKey = '[root]';
const menuTheme = {
	icon: { cursor: figures.pointer },
};
const CURSOR_HIDE = '\x1B[?25l';

// # menuPrompt()
const menuPrompt = createPrompt((config, done) => {

	// Default config.
	const {
		pageSize = 6,
		loop = false,
		menu,
	} = config;
	const theme = makeTheme(menuTheme, config.theme);

	const [status, setStatus] = useState('idle');
	const prefix = usePrefix({ status, theme });
	const [active, setActive] = useState(0);
	const [path, setPath] = useState([]);
	const [activePath, setActivePath] = useState([]);
	let obj = getCurrentObject(menu, path);

	// The `usePagination` hook can be used to easily render only a part of a 
	// list based on the pageSize and whether loop behavior should be turned on 
	// or off.
	let items = Object.entries(obj);
	const page = usePagination({
		items,
		active,
		renderItem({ item, index, isActive }) {
			let [key, value] = item;
			let line = `${key}`;
			if (typeof value === 'object') {
				line += '...';
			}
			const color = isActive ? theme.style.highlight : x => x;
			const cursor = isActive ? theme.icon.cursor : ` `;
			return color(`${cursor} ${line}`);
		},
		pageSize,
		loop,
	});

	// Setup the key handlers.
	useKeypress((key, rl) => {
		if (isEnterKey(key)) {
			let [name, value] = items[active];
			if (typeof value === 'object') {
				setPath([...path, name]);
				setActivePath([...activePath, active]);
				setActive(0);
			} else {
				if (name !== rootKey) {
					setPath([...path, name]);
				}
				setStatus('done');
				done(value);
			}
		} else if (isUpKey(key) || isDownKey(key)) {
			rl.clearLine(0);
			let offset = isUpKey(key) ? -1 : 1;
			let next = (active + offset + items.length) % items.length;
			setActive(next);
		} else if (isBackspaceKey(key)) {
			if (path.length > 0) {
				let newPath = [...path];
				newPath.pop();
				let newActivePath = [...activePath];
				setActive(newActivePath.pop());
				setPath(newPath);
				setActivePath(newActivePath);
			}
		}
	});

	const helpTip = useMemo(() => {
		const helpTipLines = [
			`${theme.style.key(figures.arrowUp + figures.arrowDown)} navigate`,
			`${theme.style.key('enter')} select`,
			`${theme.style.key('backspace')} go back`,
		];
		return helpTipLines.join(', ');
	}, []);

	// If the prompt is done, just show.
	const message = theme.style.message(config.message, status);
	if (status === 'done') {
		let activeItem = path.join(' > ');
		return `${prefix} ${message} ${theme.style.answer(activeItem)}`;
	}

	// Tie everything together.
	let header = path.join(' > ');
	return `${prefix} ${message}\n${header}\n${page}\n\n${helpTip}${CURSOR_HIDE}`;

});

function getCurrentObject(items, path) {
	let pivot = items;
	for (let key of path) {
		pivot = pivot[key];
	}
	return pivot;
}

// # buildMenuOptions()
// Merges the custom menus that we have stored with the well-known submenus (as 
// defined here: https://github.com/memo33/submenus-dll#standard-submenus
function buildMenuOptions() {

	// First we'll flatten the standard submenus into a format our tree build 
	// function understands. Note that we use a dummy so that we can properly 
	// find all orphans.
	const dummy = { [kId]: Symbol(), rooted: Menu };
	let flat = [...flatten(dummy), ...config.get('menus')];
	let [rooted, ...orphans] = buildMenuTree(flat);
	return convert([
		...rooted.children,
		orphans.length > 0 && {
			item: {
				id: Symbol(),
				name: '(Orphaned menus)',
			},
			children: orphans,
		},
	].filter(Boolean));

}

function convert(arr) {
	return Object.fromEntries(arr.map(node => {
		let { item, children } = node;
		if (children.length === 0) {
			return [item.name, item.id];
		}
		let object = {};
		if (typeof item.id !== 'symbol') {
			object[rootKey] = item.id;
		}
		Object.assign(object, convert(children));
		return [item.name, object];
	}));
}

// # flatten(node)
// Flattens a menu tree so that it can be parsed using our tree builder function.
function flatten(node) {
	let queue = [{ node, parent: null }];
	let flat = [];
	while (queue.length > 0) {
		let { node, parent } = queue.shift();
		for (let key of Object.keys(node)) {
			let value = node[key];
			if (typeof value === 'object') {

				// Verify if a "root" key was set. If this is the case, it means 
				// that submenus can be added to this level as well. If not, we 
				// create a symbol manually so that the merging algorithm still 
				// works.
				let id = value[kId] || Symbol(key);
				flat.push({
					name: key,
					id,
					parent,
				});
				queue.push({ node: value, parent: id });

			} else {
				flat.push({
					name: key,
					id: value,
					parent,
				});
			}
		}
	}
	return flat;
}

const kId = Symbol('id');
const Menu = Object.freeze({
	Flora: 0x4a22ea06,
	RCI: {
		Residential: {
			[kId]: 0x29920899,
			R$: 0x93DADFE9,
			R$$: 0x984E5034,
			R$$$: 0x9F83F133,
		},
		Commercial: {
			[kId]: 0xa998af42,
			CS$: 0x11BF1CA9,
			CS$$: 0x24C43253,
			CS$$$: 0x9BDEFE2B,
			CO$$: 0xA7FF7CF0,
			CO$$$: 0xE27B7EF6,
		},
		Industrial: {
			[kId]: 0xc998af00,
			Farms: 0xC220B7D8,
			'Dirty Industry': 0x62D82695,
			'Manufacturing Industry': 0x68B3E5FD,
			'High-Tech Industry': 0x954E20FE,
		},
	},
	Transport: {
		Road: 0x6999bf56,
		Highway: {
			[kId]: 0x31,
			Signage: 0x83E040BB,
		},
		Rail: {
			[kId]: 0x29,
			'Passenger Rail': 0x35380C75,
			'Freight Rail Stations': 0x3557F0A1,
			Yards: 0x39BA25C7,
			'HybrkId Railway': 0x2B294CC2,
			Monorail: 0x3A1D9854,
		},
		'Misc. Transit': {
			[kId]: 0x299237bf,
			Bus: 0x1FDDE184,
			GLR: 0x26B51B28,
			'El-Rail': 0x244F77E1,
			Subway: 0x231A97D3,
			'Multi-modal Stations': 0x322C7959,
			Parking: 0x217B6C35,
		},
		Airport: 0xe99234b3,
		'Water Transit': {
			[kId]: 0xa99234a6,
			'Seaports and Ferry Terminals': 0x07047B22,
			Canals: 0x03C6629C,
			Seawalls: 0x1CD18678,
			Waterfront: 0x84D42CD6,
		},
	},
	Utilities: {
		Power: {
			[kId]: 0x35,
			'Dirty Energy': 0x4B465151,
			'Clean Energy': 0xCDE0316B,
			'Miscellaneous Power Utilities': 0xD013F32D,
		},
		Water: 0x39,
		Garbage: 0x40,
	},
	Civics: {
		Police: {
			[kId]: 0x37,
			Small: 0x65D88585,
			Large: 0x7D6DC8BC,
			Deluxe: 0x8157CA0E,
			Military: 0x8BA49621,
		},
		Fire: 0x38,
		Education: {
			[kId]: 0x42,
			'Elementary Schools': 0x9FE5C428,
			'High Schools': 0xA08063D0,
			'Higher Education': 0xAC706063,
			'Libraries and Museums': 0xAEDD9FAA,
		},
		Health: {
			[kId]: 0x89dd5405,
			Small: 0xB1F7AC5B,
			Medium: 0xB7B594D6,
			Large: 0xBC251B69,
		},
		Landmark: {
			[kId]: 0x09930709,
			Government: 0x9FAF7A3B,
			'Churches and Cemeteries': 0x26EB3057,
			Entertainment: 0xBE9FDA0C,
		},
		Reward: 0x34,
		Parks: {
			[kId]: 0x3,
			'Green Spaces': 0xBF776D40,
			Plazas: 0xEB75882C,
			'Sports Grounds': 0xCE21DBEB,
			'Paths and Modular Parks': 0xDEFFD960,
			'Embankments and Retaining Walls': 0xBB531946,
			Fillers: 0xF034265C,
		},
	},
});
