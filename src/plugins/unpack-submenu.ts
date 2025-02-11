// # unpack-submenu.ts
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { FileType, LTEXT, type Exemplar } from 'sc4/core';
import type { TGIArray, TGILiteral } from 'sc4/types';
import { Document, parse, Scalar  } from 'yaml';
import PluginIndex from './plugin-index.node.js';
import { hex } from 'sc4/utils';
import { Glob } from 'glob';

type UnpackSubmenuOptions = {
	patterns?: string | string[];
	directory?: string;
	output?: string;
	logger?: any;
};

type MenuInfo = {
	existing: boolean;
	id: number;
	parent?: number;
	name?: string;
	dirname: string;
	path?: string;
	order?: number;
	description?: string | TGIArray;
	icon?: TGILiteral;
};

// # unpackSubmenu()
export default async function unpackSubmenu(opts: UnpackSubmenuOptions) {
	return await new Unpacker().unpack(opts);
};

// # Unpacker
class Unpacker {
	index: PluginIndex;
	menus: Map<number, MenuInfo> = new Map();

	// ## unpack()
	// Entry point for unpacking a directory containing a bunch of submenus.
	async unpack(opts: UnpackSubmenuOptions) {
		let {
			patterns = '**/*.dat',
			directory = process.cwd(),
			output = process.cwd(),
			logger,
		} = opts;

		// Build up the plugin index first.
		this.index = new PluginIndex({
			scan: patterns,
			plugins: directory,
			core: false,
		});
		await this.index.build();

		// Read in the exemplars first and look for the menus configurations.
		let exemplars = this.index.findAll({
			type: FileType.Exemplar,
			group: 0x2a3858e4,
		});
		let had = new Set<string>();
		for (let entry of exemplars) {
			let { file } = entry.dbpf;
			if (!had.has(file!)) {
				had.add(file!);
				logger?.info(`Reading ${path.relative(directory, file!)}`);
			}
			this.parseExemplar(entry.read());
		}

		// Parse any existing menus in the output dirctory as well.
		await this.parseExistingMenus(output);

		// Loop all menus and fill in their paths.
		outer:
		for (let menu of this.menus.values()) {
			if (menu.path) continue;
			if (!menu.parent) {
				logger?.warn(`Menu ${menu.name} has no parent set!`);
				continue;
			}
			let chain = [menu.dirname];
			let parent = this.menus.get(menu.parent);
			while (parent && !parent.path) {
				chain.unshift(parent.dirname);
				if (!parent.parent) continue outer;
				parent = this.menus.get(parent.parent);
			}
			if (parent && parent.path) {
				chain.unshift(parent.path);
			} else {
				chain.unshift(path.join(output, 'orphans'));
			}
			menu.path = path.join(...chain);
		}

		// Next we'll create the actual folders with the unpacked _menu.yaml and 
		// _icon.png. These need to be present before we can loop the cohorts 
		// and look for patches.
		for (let menu of this.menus.values()) {
			if (menu.existing) continue;

			// Check if we can find the parent menu folder. If not, this is an 
			// orphaned menu and we should add it to that folder as well.
			let dir = menu.path;
			if (!dir) continue;
			await fs.promises.mkdir(dir, { recursive: true });

			// Write away the _menu.yaml file. Note that the parent menu gets 
			// included here if it's an orphan!
			let parent = this.menus.get(menu.parent!);
			let doc = stylize(new Document({
				id: menu.id,
				...!parent ? { parent: menu.parent } : null,
				name: menu.name,
				description: menu.description,
			}));
			await fs.promises.writeFile(
				path.join(dir, '_menu.yaml'),
				String(doc),
			);

			// Unpack the png icon as well, if it exists.
			if (menu.icon) {
				let png = this.index.find(menu.icon)!.read() as Uint8Array;
				await fs.promises.writeFile(path.join(dir, '_icon.png'), png);
			}

		}

		// Next we'll read in the cohorts to look for patches.
		let cohorts = this.index.findAll({
			type: FileType.Cohort,
			group: 0xb03697d1,
		});
		for (let entry of cohorts) {

			// Find out what menu the patch belongs to. If no parent was found, 
			// we shortcut obviously.
			let cohort = entry.read();
			let [menuId] = cohort.get('BuildingSubmenus') ?? [];
			if (!menuId) continue;
			let parent = this.menus.get(menuId);
			if (!parent) continue;

			// Log that we're reading the cohort.
			let file = entry.dbpf.file!;
			if (!had.has(file)) {
				had.add(file);
				logger?.info(`Reading ${path.relative(directory, file)}`);
			}

			// Read in the target file if it already exists so that we can 
			// ensure we don't add pairs twice.
			let { dbpf } = entry;
			let basename = path.basename(dbpf.file!, path.extname(dbpf.file!));
			let fullPath = path.join(parent.path!, `${basename}.txt`);
			let existingTargets = new Set();
			try {
				let contents = String(await fs.promises.readFile(fullPath));
				let lines = contents.trim().split('\n');
				for (let line of lines) {
					let [group, instance] = line.split(',');
					existingTargets.add(`${hex(+group)}, ${hex(+instance)}`);
				}
			} catch (e) {
				if (e.code !== 'ENOENT') throw e;
			}

			// Serialize the patch targets as hex numbers, make sure we don't 
			// duplicate and then write away.
			let targets = cohort.get('ExemplarPatchTargets') ?? [];
			while (targets.length > 0) {
				let group = targets.shift()!;
				let instance = targets.shift();
				if (instance === undefined) break;
				existingTargets.add(`${hex(+group)}, ${hex(+instance)}`);
			}
			let contents = [...existingTargets].join(os.EOL)+os.EOL;
			await fs.promises.writeFile(fullPath, contents);
			
		}

	}

	// ## parseExemplar(exemplar)
	// Parses an exemplar and extracts the basic menu information from it.
	parseExemplar(exemplar: Exemplar) {
		let buttonId = exemplar.get('ItemButtonID');
		if (!buttonId) return;

		// Find the description for this menu. We require this to be in this 
		// file, though this is not strictly require by the game obviously! 
		// It's the convention though.
		let name;
		let uvnk = exemplar.get('UserVisibleNameKey');
		if (uvnk) {
			let [type, group, instance] = uvnk;
			let ltext = this.index.find({ type, group, instance });
			if (ltext) {
				name = String(ltext.read() as LTEXT);
			}
		}

		// Check for the description. Note that if the description was not 
		// found, we store it as a tgi instead.
		let description: string | TGIArray | undefined;
		let idk = exemplar.get('ItemDescriptionKey');
		if (idk) {
			let [type, group, instance] = idk;
			let ltext = this.index.find({ type, group, instance });
			if (ltext) {
				description = String(ltext.read() as LTEXT);
			} else {
				description = [type, group, instance];
			}
		}

		// Store the icon as well if it exists.
		let icon;
		let iconInstance = exemplar.get('ItemIcon');
		if (iconInstance) {
			let entry = this.index.find({
				type: FileType.PNG,
				group: 0x6a386d26,
				instance: iconInstance,
			});
			if (entry) {
				let { type, group, instance } = entry;
				icon = { type, group, instance };
			}
		}

		// Determine the basename for the menu's directory.
		let order = exemplar.get('ItemOrder') ?? 0;
		let prefix = '0x'+order.toString(16).padStart(8, '0').toUpperCase();
		let exemplarName = exemplar.get('ExemplarName') ?? '';
		if (order >= 0x80000000) prefix = `_${prefix}`;
		this.menus.set(buttonId, {
			existing: false,
			id: buttonId,
			parent: exemplar.get('ItemSubmenuParentId'),
			name,
			dirname: `${prefix}-${exemplarName}`,
			order,
			description,
			icon,
		});

	}
	async parseExistingMenus(directory: string) {
		let glob = new Glob('**/_menu.yaml', {
			cwd: directory,
			absolute: true,
		});
		let files = await glob.walk();
		for (let file of files) {
			let yaml = String(await fs.promises.readFile(file));
			let parsed = parse(yaml);
			this.menus.set(parsed.id, {
				existing: true,
				id: parsed.id,
				dirname: path.basename(path.dirname(file)),
				path: path.dirname(file),
			});
		}
	}

}

function stylize(doc: Document) {
	(doc.get('id', true) as Scalar || {}).format = 'HEX';
	(doc.get('parent', true) as Scalar || {}).format = 'HEX';
	let desc = doc.get('description', true) as any;
	if (desc?.items) {
		desc.flow = true;
		for (let item of desc.items) {
			item.format = 'HEX';
		}
	}
	return doc;
}
