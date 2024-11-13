// # change-icon-flow.js
import path from 'node:path';
import { DBPF, FileType } from 'sc4/core';
import * as prompts from '#cli/prompts';
import logger from '#cli/logger.js';
import backup from '#cli/backup.js';
import folders from '#cli/folders.js';

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

// # changeIcon()
export async function changeIcon() {

	// Pick the file where we have to look for icons.
	let file = await prompts.file({
		argv: true,
		basePath: folders.plugins,
		message: 'Pick the file where the icon is located',
	});

	// Cool, we got the dbpf, now read in all exemplars.
	let fullPath = path.resolve(process.cwd(), file);
	let dbpf = new DBPF(fullPath);
	let entries = dbpf.exemplars.map(entry => {
		let exemplar = entry.read();
		let icon = exemplar.value(0x8A2602B8);
		if (!icon) return;
		let iconEntry = dbpf.find({
			type: FileType.PNG,
			instance: entry.instance,
		});
		if (!iconEntry) return;
		let name = exemplar.value(Props.ExemplarName);
		let nameKey = exemplar.value(Props.UserVisibleNameKey);
		if (nameKey) {
			let ltext = dbpf.find(nameKey);
			if (ltext) {
				name = ltext.read().value;
			}
		}
		return {
			name,
			entry: iconEntry,
		};
	}).filter(Boolean);

	// If there's nothing in this dbpf, do nothing but log a warning.
	if (entries.length === 0) {
		logger.warn(
			'No exemplars with the ItemIcon property were found in this file!',
		);
		return false;
	}

	// If there are multiple entries, we first need to find what one we'll be 
	// using.
	let [{ entry }] = entries;
	if (entries.length > 1) {
		let choices = entries.map(row => {
			return {
				name: row.name,
				value: row.entry,
			};
		});
		entry = await prompts.select({
			message: 'What menu item do you want to change the icon for?',
			choices,
		});
	}

	// Open up the prompt with the menu icon.
	let png = entry.read();
	let icon = await prompts.menuIcon({
		message: 'Choose the icon to use:',
		default: png,
		templated: false,
	});

	// Make sure to create a backup of the file we're modifying before saving it.
	await backup(fullPath, { logger });

	// Store the icon on the dbpf & save again.
	entry.buffer = icon;
	dbpf.save(fullPath);
	logger.ok(`Saved to ${fullPath}`);

}
