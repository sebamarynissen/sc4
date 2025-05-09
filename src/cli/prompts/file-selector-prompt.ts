import path from 'node:path';
import os from 'node:os';
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
    type KeypressEvent,
    type Theme,
} from '@inquirer/core';
import figures from '@inquirer/figures';
import chalk from 'chalk';
import checkUnicode from 'is-unicode-supported';

function checkWindowsUnicode() {
	const [major,, build] = os.release().split('.');
	return +major > 10 || (+major === 10 && +build >= 22000);
}

// Windows 11 supports unicode in the terminal, which can be detected by the 
// build number being above 22000
const isUnicodeSupported = checkUnicode() || checkWindowsUnicode();

// Utils.ts
import fs, { Stats } from 'node:fs';
const CURSOR_HIDE = '\x1B[?25l';
function isEscapeKey(key: KeypressEvent) {
	return key.name === 'escape';
}
function ensureTrailingSlash(dir: string) {
	return dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;
}
function stripAnsiCodes(str: string) {
	// eslint-disable-next-line no-control-regex
	return str.replace(/\x1B\[\d+m/g, '');
}
function getMaxLength(arr: string[]) {
	return arr.reduce(
		(max, item) => Math.max(max, stripAnsiCodes(item).length),
		0,
	);
}
function getDirFiles(dir: string) {
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
	}).filter(Boolean) as FileInfo[];
}
function sortFiles(files: FileInfo[], showExcluded: boolean) {
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
		linePrefix: (item: FileInfo, isLast: boolean) => {
			let lines = isLast ? `${figures.lineUpRight}${figures.line.repeat(2)} ` : `${figures.lineUpDownRight}${figures.line.repeat(2)} `;
			if (isUnicodeSupported && item.isDirectory()) {
				lines += '📁 ';
			}
			return lines;
		},
	},
	style: {
		disabled: (text: string) => chalk.dim(text),
		active: (text: string) => chalk.cyan(text),
		cancelText: (text: string) => chalk.red(text),
		emptyText: (text: string) => chalk.red(text),
		directory: (text: string) => chalk.yellow(text),
		file: (text: string) => chalk.white(text),
		currentDir: (text: string) => chalk.magenta(text),
		message: (text: string, _status: string) => chalk.bold(text),
		help: (text: string) => chalk.white(text),
		key: (text: string) => chalk.cyan(text),
	},
};

export type FileInfo = Stats & { name: string; path: string; isDisabled: boolean; }

export type FileSelectorConfig = {
	message: string;
	basePath?: string;
	type?: 'file' | 'directory' | 'file+directory';
	pageSize?: number;
	loop?: boolean;
	showExcluded?: boolean;
	disabledLabel?: string;
	allowCancel?: boolean;
	cancelText?: string;
	emptyText?: string;
	theme?: Theme;
	filter?: (file: FileInfo) => boolean;
	transform?: (item: FileInfo) => string;
};

export const fileSelector = createPrompt<string, FileSelectorConfig>((config: FileSelectorConfig, done: any) => {
	const {
		type = 'file',
		pageSize = 10,
		loop = false,
		showExcluded = false,
		disabledLabel = ' (not allowed)',
		allowCancel = false,
		cancelText = 'Canceled.',
		emptyText = 'Directory is empty.',
		transform = (item: FileInfo) => item.name,
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
			file!.isDisabled = config.filter ? !config.filter(file!) : false;
		}
		return sortFiles(files, showExcluded);
	}, [currentDir]) as FileInfo[];
	const map = useMemo(() => ({}) as any, []);
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
		} else if ((key.name === 'right' || isSpaceKey(key)) && activeItem.isDirectory()) {
			setCurrentDir(activeItem.path);
			setActive(map[activeItem.path] ?? bounds.first);
		} else if (isUpKey(key) || isDownKey(key)) {
			rl.clearLine(0);
			if (loop || isUpKey(key) && active !== bounds.first || isDownKey(key) && active !== bounds.last) {
				const offset = isUpKey(key) ? -1 : 1;
				map[currentDir] = active+offset;
				let next = active;
				do {
					next = (next + offset + items.length) % items.length;
				} while (items[next].isDisabled);
				setActive(next);
			}
		} else if (isBackspaceKey(key) || key.name === 'left') {
			let up = path.resolve(currentDir, '..');
			setCurrentDir(up);
			setActive(map[up] ?? bounds.first);
		} else if (isEscapeKey(key) && allowCancel) {
			setStatus('canceled');
			done('canceled');
		}
	});

	// The `usePagination` function is used to actually render the items on the 
	// screen and make pagination possible.
	const page = usePagination({
		items,
		active,
		renderItem({ item, index, isActive }) {
			const isLast = index === items.length - 1;
			const linePrefix = theme.icon.linePrefix(item, isLast);
			const name = transform(item);
			const line = item.isDirectory() ? `${linePrefix}${ensureTrailingSlash(name)}` : `${linePrefix}${name}`;
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

	// Render the rest of the information.
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
			`${theme.style.key(figures.arrowRight)} open directory, ${theme.style.key(figures.arrowLeft)} go back`,
		];
		const helpTipMaxLength = getMaxLength(helpTipLines);
		const delimiter = figures.lineBold.repeat(helpTipMaxLength);
		return `${delimiter}
${helpTipLines.join('\n')}`;
	}, []);

	// At last, join everything together.
	return `${prefix} ${message}
${header}
${!page.length ? theme.style.emptyText(emptyText) : page}
${helpTip}${CURSOR_HIDE}`;
});
