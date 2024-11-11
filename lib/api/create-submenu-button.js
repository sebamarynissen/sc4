// # create-submenu-button.js
import { fs, path, randomId, hex } from 'sc4/utils';
import { DBPF, Exemplar, LTEXT, FileType } from 'sc4/core';
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

// # creatSubmenuButton(opts)
// Generates a .dat file that adds a submenu button to another menu.
export default async function createSubmenuButton(opts) {

	let {
		name,
		description = '',
		buttonId = randomId(),
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
	exemplar.addProperty(Props.ItemDescriptionKey, [
		FileType.LTEXT,
		Groups.Description,
		buttonId,
	]);

	// Add the exemplar to a DBPF. The exemplar will be compressed.
	let dbpf = new DBPF();
	let desc = dbpf.add([FileType.Exemplar, 0x2a3858e4, buttonId], exemplar);
	desc.compressed = true;

	// Add the LTEXT files as well. No compression here.
	dbpf.add(
		[FileType.LTEXT, Groups.Name, buttonId],
		new LTEXT(name),
	);
	dbpf.add(
		[FileType.LTEXT, Groups.Description, buttonId],
		new LTEXT(description),
	);

	// At last we'll add the png icon as well. Note that the icon can be 
	// specified as a raw buffer, but it can also be a file - in which case we 
	// run on Node.js. In the browser, only a Buffer or Uint8Array is supported 
	// obviously.
	if (typeof icon === 'string') {
		icon = await fs.promises.readFile(icon);
	}
	dbpf.add([FileType.PNG, Groups.Icon, buttonId], icon);

	// Save the dbpf as well if specified.
	if (opts.save) {
		let {
			directory = process.cwd(),
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
		name,
		description,
	};
	logger?.info(`Button id is ${hex(button.id)}`);
	return { dbpf, button };

}
