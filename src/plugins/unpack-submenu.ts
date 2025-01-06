// # unpack-submenu.ts
import path from 'node:path';
import fs from 'node:fs';
import { DBPF, FileType, type Exemplar } from 'sc4/core';
import type { TGILiteral } from 'sc4/types';
import { Document, Scalar  } from 'yaml';

type UnpackSubmenuOptions = {
	file?: string
	dbpf?: DBPF;
	output: string;
};

type MenuYaml = {
	id: number;
	parent: number;
	name: string;
	order: number;
	description?: string;
	icon?: TGILiteral;
};

// # unpackSubmenu(opts)
// Unpacks a dbpf file containing a submenu button or submenu patches.
export default async function unpackSubmenu(opts: UnpackSubmenuOptions) {

	// Group all entries by type because we will first need to handle the 
	// exemplars to create the main folders.
	let { dbpf, file } = opts;
	if (!dbpf) {
		dbpf = new DBPF(file!);
	}
	let {
		exemplars = [],
		cohorts = [],
	} = Object.groupBy(dbpf.entries, entry => {
		switch (entry.type) {
			case FileType.Exemplar: return 'exemplars';
			case FileType.Cohort: return 'cohorts';
			default: return 'ignore';
		}
	});

	// Read all the exemplars looking for a submenu.
	let menus: MenuYaml[] = [];
	for (let entry of exemplars) {
		let exemplar = entry.read() as Exemplar;
		let buttonId = exemplar.get('ItemButtonID');
		if (!buttonId) continue;

		// Find the description for this menu. We require this to be in this 
		// file, though this is not strictly require by the game obviously! It's 
		// the convention though.
		let description;
		let uvnk = exemplar.get('UserVisibleNameKey');
		if (uvnk) {
			let [type, group, instance] = uvnk;
			let ltext = dbpf.find({ type, group, instance });
			if (ltext) {
				description = String(ltext.read());
			}
		}

		// Store the icon as well if it exists.
		let icon;
		let iconInstance = exemplar.get('ItemIcon');
		if (iconInstance) {
			let entry = dbpf.find({
				type: FileType.PNG,
				group: 0x6a386d26,
				instance: iconInstance,
			});
			if (entry) {
				let { type, group, instance } = entry;
				icon = { type, group, instance };
			}
		}
		menus.push({
			id: buttonId,
			parent: exemplar.get('ItemSubmenuParentId')!,
			name: exemplar.get('ExemplarName') ?? '',
			order: exemplar.get('ItemOrder') ?? 0,
			description,
			icon,
		});

	}

	// Unpack the menu to the output directory and then store where this menu 
	// was stored.
	let created = new Map<number, string>();
	for (let menu of menus.values()) {
		let { order } = menu;
		let prefix = '0x'+order.toString(16).padStart(8).toUpperCase();
		if (order >= 0x80000000) prefix = `_${prefix}`;
		let dir = path.resolve(opts.output, `${prefix}-${menu.name}`);
		await fs.promises.mkdir(dir, { recursive: true });

		// Write away the _menu.yaml file. Note that the parent menu gets 
		// included here. In the submenu collection repository it will be 
		// filtered out again and just derived from the parent folder!
		let doc = new Document({
			id: menu.id,
			parent: menu.parent,
			description: menu.description,
		});
		(doc.get('id', true) as Scalar || {}).format = 'HEX';
		(doc.get('parent', true) as Scalar || {}).format = 'HEX';
		await fs.promises.writeFile(path.join(dir, '_menu.yaml'), String(doc));

		// Unpack the png icon as well, if it exists.
		if (menu.icon) {
			let png = dbpf.find(menu.icon)!.read() as Uint8Array;
			await fs.promises.writeFile(path.join(dir, '_icon.png'), png);
		}

		// Store where this menu is stored so that we can unpack the patches to 
		// this folder later on.
		created.set(menu.id, dir);

	}

}
