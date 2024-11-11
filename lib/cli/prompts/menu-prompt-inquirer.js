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
				setActive(0);
			} else {
				if (name !== '[root]') {
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
			let newPath = [...path];
			newPath.pop();
			setPath(newPath);
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
