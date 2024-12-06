// # scan-for-menus-command.js
import path from 'node:path';
import { Glob } from 'glob';
import ora from 'ora';
import chalk from 'chalk';
import config from '#cli/config.js';
import logger from '#cli/logger.js';
import { getAllIds } from '#cli/data/standard-menus.js';
import { DBPF } from 'sc4/core';

const Props = {
	ExemplarType: 0x10,
	ExemplarName: 0x20,
	ItemIcon: 0x8A2602B8,
	ItemOrder: 0x8A2602B9,
	ItemButtonId: 0x8A2602BB,
	ItemSubmenuParentId: 0x8A2602CA,
	ItemButtonClass: 0x8A2602CC,
	UserVisibleNameKey: 0x8A416A99,
	ItemDescriptionKey: 0xCA416AB5,
};

// # scanForMenus()
// Performs a scan of the user's plugin folder and reports any submenus found in 
// it.
export async function scanForMenus(folder = process.env.SC4_PLUGINS, options) {
	let glob = new Glob('**/*.dat', {
		nodir: true,
		cwd: folder,
		nocase: true,
	});
	let tasks = [];
	const spinner = ora();
	spinner.start();
	let menus = [];
	for await (let file of glob) {
		let fullPath = path.join(folder, file);
		let dbpf = new DBPF({
			file: fullPath,
			parse: false,
		});
		await dbpf.parseAsync();
		spinner.text = `Scanning ${chalk.cyan(file)}`;
		for (let entry of dbpf.exemplars) {
			tasks.push(getMenu(entry, menus));
		}
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
	for (let menu of configMenus) {
		map.set(menu.id, menu);
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
	logger.ok(`Added ${added} new menus to your menu config`);

}

async function getMenu(entry, menus) {
	let exemplar;
	try {
		exemplar = entry.read();
	} catch {
		return;
	}
	let parent = exemplar.value(Props.ItemSubmenuParentId);
	if (!parent) return null;
	let { instance: id } = entry;
	let name = exemplar.value(Props.UserVisibleNameKey);
	if (typeof name !== 'string') {
		let ltext = entry.dbpf.find(name);
		if (!ltext) return;
		({ value: name } = await ltext.readAsync());
	}
	menus.push({
		id,
		parent,
		name: name.trim(),
		order: exemplar.value(Props.ItemOrder),
	});

}
