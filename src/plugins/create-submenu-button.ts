// # create-submenu-button.ts
import { fs, path, randomId, hex } from 'sc4/utils';
import { DBPF, Exemplar, LTEXT, FileType, OccupantGroups } from 'sc4/core';
import type { Logger, TGIArray, TGILiteral } from 'sc4/types';
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

const Groups = {
	Name: 0x123007bb,
	Description: 0x123006aa,
	Icon: 0x6a386d26,
};

type createSubmenuButtonOptions = {
	name: string;
	description?: string | TGIArray | TGILiteral;
	buttonId?: number;
	icon?: Uint8Array | string;
	parent: number;
	logger?: Logger;
	save?: boolean;
	order?: number;
	directory?: string;
	output?: string;
};

// # creatSubmenuButton(opts)
// Generates a .dat file that adds a submenu button to another menu.
export default async function createSubmenuButton(
	opts: createSubmenuButtonOptions,
) {

	// If no description is specified, we use the default description of memo's 
	// submenus, being "Click here to open submenu".
	let {
		name,
		description = [0x2026960b, 0x123006aa, 0x6e967dff],
		buttonId = randomId({ except: excluded }),
		icon,
		parent,
		order = 0,
		logger,
	} = opts;
	let id = name.toLowerCase().replaceAll(/ /g, '-');

	// Create the fresh exemplar and fill in the properties.
	let exemplar = new Exemplar();
	exemplar.addProperty(Props.ExemplarType, 0x28);
	exemplar.addProperty(Props.ExemplarName, `submenu-${id}`);
	exemplar.addProperty(Props.ItemIcon, buttonId);
	exemplar.addProperty(Props.ItemOrder, order);
	exemplar.addProperty(Props.ItemButtonId, buttonId);
	exemplar.addProperty(Props.ItemSubmenuParentId, parent);
	exemplar.addProperty(Props.ItemButtonClass, 0x01);

	// The user visible name and description are stored in LTEXT files.
	exemplar.addProperty(Props.UserVisibleNameKey, [
		FileType.LTEXT,
		Groups.Name,
		buttonId,
	]);

	// If the description is given as a TGI literal, then we add it as such.
	if (typeof description !== 'string') {
		let tgi: number[];
		if (Array.isArray(description)) {
			tgi = description;
		} else {
			let { type, group, instance } = description
			tgi = [type, group, instance];
		}
		exemplar.addProperty(Props.ItemDescriptionKey, tgi);
	} else {
		exemplar.addProperty(Props.ItemDescriptionKey, [
			FileType.LTEXT,
			Groups.Description,
			buttonId,
		]);
	}

	// Add the exemplar to a DBPF. The exemplar will be compressed.
	let dbpf = new DBPF();
	let desc = dbpf.add([FileType.Exemplar, 0x2a3858e4, buttonId], exemplar);
	desc.compressed = true;

	// Add the LTEXT files as well. No compression here.
	dbpf.add(
		[FileType.LTEXT, Groups.Name, buttonId],
		new LTEXT(name),
	);
	if (typeof description === 'string') {
		dbpf.add(
			[FileType.LTEXT, Groups.Description, buttonId],
			new LTEXT(description),
		);
	}

	// At last we'll add the png icon as well. Note that the icon can be 
	// specified as a raw buffer, but it can also be a file - in which case we 
	// run on Node.js. In the browser, only a Buffer or Uint8Array is supported 
	// obviously.
	if (typeof icon === 'string') {
		icon = await fs.promises.readFile(icon);
	}
	if (icon) {
		dbpf.add([FileType.PNG, Groups.Icon, buttonId], icon);
	}

	// Save the dbpf as well if specified.
	if (opts.save) {
		let {
			directory = process.env.SC4_PLUGINS ?? process.cwd(),
			output = `submenu-${id}.dat`,
		} = opts;
		let outputPath = path.resolve(directory, output);
		let buffer = dbpf.toBuffer();
		await fs.promises.writeFile(outputPath, buffer);
		logger?.ok(`Submenu saved to ${outputPath}`);
	}

	// Return both the dbpf, as well as the generated button id.
	const button = {
		id: buttonId,
		parent,
		order,
		name,
		description,
	};
	logger?.info(`Button id is ${hex(button.id)}`);
	return { dbpf, button };

}

// See https://github.com/memo33/submenus-dll#creating-a-new-submenu-button
// If we generate a random button id, it should not be any of the following ids 
// because they are OccupantGroups. Note that if we generate it randomly, 
// changes are slim of a clash, but still, let's be sure.
const excluded = Object.values(OccupantGroups);
