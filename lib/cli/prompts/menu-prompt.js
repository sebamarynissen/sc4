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
import Menu, { kId } from '#cli/data/standard-menus.js';
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
	let flat = [...flatten(dummy), ...config.get('menus') || []];
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
