// # change-icon-flow.js
import path from 'node:path';
import { DBPF, FileType } from 'sc4/core';
import * as prompts from '#cli/prompts';
import logger from '#cli/logger.js';

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
		message: 'Pick the file where the icon is located',
		raw: true,
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
		return {
			name: (
				exemplar.value(Props.UserVisibleNameKey) ||
				exemplar.value(Props.ExemplarName)
			),
			entry: iconEntry,
		};
	}).filter(Boolean);

	// Open up the prompt with the menu icon.
	let [{ entry }] = entries;
	let png = entry.read();
	let icon = await prompts.menuIcon({
		message: 'Choose the icon to use:',
		default: png,
		raw: true,
	});

	// Store the icon on the dbpf & save again.
	entry.buffer = icon;
	dbpf.save(fullPath);
	logger.ok(`Saved to ${fullPath}`);

}
