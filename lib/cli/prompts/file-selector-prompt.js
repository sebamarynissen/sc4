import path from 'node:path';
import {
	createPrompt,
	isBackspaceKey,
	isDownKey,
	isEnterKey,
	isSpaceKey,
	isUpKey,
	makeTheme,
	useKeypress,
	useMemo,
	usePagination,
	usePrefix,
	useState,
} from '@inquirer/core';
import figures from '@inquirer/figures';
import chalk from 'chalk';

// Utils.ts
import fs from 'node:fs';
const CURSOR_HIDE = '\x1B[?25l';
function isEscapeKey(key) {
	return key.name === 'escape';
}
function ensureTrailingSlash(dir) {
	return dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
}
function stripAnsiCodes(str) {
	// eslint-disable-next-line no-control-regex
	return str.replace(/\x1B\[\d+m/g, '');
}
function getMaxLength(arr) {
	return arr.reduce(
		(max, item) => Math.max(max, stripAnsiCodes(item).length),
		0,
	);
}
function getDirFiles(dir) {
	return fs.readdirSync(dir).map((filename) => {
		try {
			const filepath = path.join(dir, filename);
			const fileStat = fs.statSync(filepath);
			return Object.assign(fileStat, {
				name: filename,
				path: filepath,
				isDisabled: false,
			});
		} catch {
			return null;
		}
	}).filter(Boolean);
}
function sortFiles(files, showExcluded) {
	return files.sort((a, b) => {
		if (a.isDisabled && !b.isDisabled) {
			return 1;
		}
		if (!a.isDisabled && b.isDisabled) {
			return -1;
		}
		if (a.isDirectory() && !b.isDirectory()) {
			return -1;
		}
		if (!a.isDirectory() && b.isDirectory()) {
			return 1;
		}
		return a.name.localeCompare(b.name);
	}).filter((file) => showExcluded || !file.isDisabled);
}

const fileSelectorTheme = {
	prefix: {
		idle: chalk.cyan('?'),
		done: chalk.green(figures.tick),
		canceled: chalk.red(figures.cross),
	},
	icon: {
		linePrefix: (isLast) => {
			return isLast ? `${figures.lineUpRight}${figures.line.repeat(2)} ` : `${figures.lineUpDownRight}${figures.line.repeat(2)} `;
		},
	},
	style: {
		disabled: (text) => chalk.dim(text),
		active: (text) => chalk.cyan(text),
		cancelText: (text) => chalk.red(text),
		emptyText: (text) => chalk.red(text),
		directory: (text) => chalk.yellow(text),
		file: (text) => chalk.white(text),
		currentDir: (text) => chalk.magenta(text),
		message: (text, _status) => chalk.bold(text),
		help: (text) => chalk.white(text),
		key: (text) => chalk.cyan(text),
	},
};
export const fileSelector = createPrompt((config, done) => {
	const {
		type = 'file',
		pageSize = 10,
		loop = false,
		showExcluded = false,
		disabledLabel = ' (not allowed)',
		allowCancel = false,
		cancelText = 'Canceled.',
		emptyText = 'Directory is empty.',
	} = config;
	const [status, setStatus] = useState('idle');
	const theme = makeTheme(fileSelectorTheme, config.theme);
	const prefix = usePrefix({ status, theme });
	const [currentDir, setCurrentDir] = useState(
		path.resolve(process.cwd(), config.basePath || '.'),
	);
	const items = useMemo(() => {
		const files = getDirFiles(currentDir);
		for (const file of files) {
			file.isDisabled = config.filter ? !config.filter(file) : false;
		}
		return sortFiles(files, showExcluded);
	}, [currentDir]);
	const bounds = useMemo(() => {
		const first = items.findIndex((item) => !item.isDisabled);
		const last = items.findLastIndex((item) => !item.isDisabled);
		if (first === -1) {
			return { first: 0, last: 0 };
		}
		return { first, last };
	}, [items]);
	const [active, setActive] = useState(bounds.first);
	const activeItem = items[active];
	useKeypress((key, rl) => {
		if (isEnterKey(key)) {
			if (activeItem.isDisabled || type === 'file' && activeItem.isDirectory() || type === 'directory' && !activeItem.isDirectory()) {
				return;
			}
			setStatus('done');
			done(activeItem.path);
		} else if (isSpaceKey(key) && activeItem.isDirectory()) {
			setCurrentDir(activeItem.path);
			setActive(bounds.first);
		} else if (isUpKey(key) || isDownKey(key)) {
			rl.clearLine(0);
			if (loop || isUpKey(key) && active !== bounds.first || isDownKey(key) && active !== bounds.last) {
				const offset = isUpKey(key) ? -1 : 1;
				let next = active;
				do {
					next = (next + offset + items.length) % items.length;
				} while (items[next].isDisabled);
				setActive(next);
			}
		} else if (isBackspaceKey(key)) {
			setCurrentDir(path.resolve(currentDir, '..'));
			setActive(bounds.first);
		} else if (isEscapeKey(key) && allowCancel) {
			setStatus('canceled');
			done('canceled');
		}
	});
	const page = usePagination({
		items,
		active,
		renderItem({ item, index, isActive }) {
			const isLast = index === items.length - 1;
			const linePrefix = theme.icon.linePrefix(isLast);
			const line = item.isDirectory() ? `${linePrefix}${ensureTrailingSlash(item.name)}` : `${linePrefix}${item.name}`;
			if (item.isDisabled) {
				return theme.style.disabled(`${line}${disabledLabel}`);
			}
			const baseColor = item.isDirectory() ? theme.style.directory : theme.style.file;
			const color = isActive ? theme.style.active : baseColor;
			return color(line);
		},
		pageSize,
		loop,
	});
	const message = theme.style.message(config.message, status);
	if (status === 'canceled') {
		return `${prefix} ${message} ${theme.style.cancelText(cancelText)}`;
	}
	if (status === 'done') {
		return `${prefix} ${message} ${theme.style.answer(activeItem.path)}`;
	}
	const header = theme.style.currentDir(ensureTrailingSlash(currentDir));
	const helpTip = useMemo(() => {
		const helpTipLines = [
			`${theme.style.key(figures.arrowUp + figures.arrowDown)} navigate, ${theme.style.key('<enter>')} select${allowCancel ? `, ${theme.style.key('<esc>')} cancel` : ''}`,
			`${theme.style.key('<space>')} open directory, ${theme.style.key('<backspace>')} go back`,
		];
		const helpTipMaxLength = getMaxLength(helpTipLines);
		const delimiter = figures.lineBold.repeat(helpTipMaxLength);
		return `${delimiter}
${helpTipLines.join('\n')}`;
	}, []);
	return `${prefix} ${message}
${header}
${!page.length ? theme.style.emptyText(emptyText) : page}
${helpTip}${CURSOR_HIDE}`;
});
