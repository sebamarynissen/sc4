// # scan-for-menus-command.js
import PQueue from 'p-queue';
import ora, { type Ora } from 'ora';
import chalk from 'chalk';
import config from '#cli/config.js';
import logger from '#cli/logger.js';
import { getAllIds } from '#cli/data/standard-menus.js';
import { DBPF, Exemplar, type Entry } from 'sc4/core';
import { FileScanner } from 'sc4/plugins';
import type { TGIArray } from 'sc4/types';
import type LText from 'src/core/ltext.js';

type Menu = {
	id: number;
	parent?: number;
	name: string;
	order?: number;
};

type ScanForMenusOptions = {
	override?: boolean;
};

// # scanForMenus()
// Performs a scan of the user's plugin folder and reports any submenus found in 
// it.
export async function scanForMenus(
	folder = process.env.SC4_PLUGINS,
	opts: ScanForMenusOptions = {},
) {
	const queue = new PQueue({ concurrency: 4096 });
	let glob = new FileScanner('**/*', { cwd: folder });
	let tasks = [];
	const spinner = ora();
	spinner.start();
	let menus: Menu[] = [];
	for await (let file of glob) {
		let task = queue.add(async () => {
			let dbpf = new DBPF({ file, parse: false });
			await dbpf.parseAsync();
			dbpf.createIndex();
			let subtasks = [];
			for (let entry of dbpf.exemplars) {
				let subtask = queue.add(() => getMenu(entry, menus, spinner));
				subtasks.push(subtask);
			}
			await Promise.allSettled(subtasks);
		});
		tasks.push(task);
	}
	await Promise.allSettled(tasks);
	spinner.stop();
	
	// Now that we have all menus, we still need to filter out any of the 
	// standard menus.
	let set = new Set(getAllIds());
	menus = menus.filter(menu => !set.has(menu.id));
	logger.ok(`Found ${menus.length} menus`);

	// Now merge with the existing menus as stored in the config, but make sure 
	// to not override!
	let configMenus = config.get('menus') || [];
	let map = new Map();
	if (!opts.override) {
		for (let menu of configMenus) {
			map.set(menu.id, menu);
		}
	}
	let added = 0;
	for (let menu of menus) {
		if (!map.has(menu.id)) {
			map.set(menu.id, menu);
			added++;
		}
	}
	if (map.size > 0) {
		config.set('menus', [...map.values()]);
	} else {
		config.delete('menus');
	}
	if (opts.override) {
		logger.ok(`Added ${added} menus to your menu config`);
	} else {
		logger.ok(`Added ${added} new menus to your menu config`);
	}

}

async function getMenu(entry: Entry<Exemplar>, menus: Menu[], spinner: Ora) {
	spinner.text = `Scanning ${chalk.cyan(entry.dbpf.file)}`;
	let exemplar;
	try {
		exemplar = await entry.readAsync();
	} catch {
		return;
	}
	let parent = exemplar.get('ItemSubmenuParentId');
	if (!parent) return null;
	let { instance: id } = entry;
	let uvnk = exemplar.get('UserVisibleNameKey');
	let name = '';
	if (uvnk) {
		let ltext = entry.dbpf.find(uvnk as TGIArray);
		if (!ltext) return;
		({ value: name } = await ltext.readAsync() as LText);
	}
	menus.push({
		id,
		parent,
		name: name.trim(),
		order: exemplar.get('ItemOrder'),
	});

}
