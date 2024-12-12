// # generate-exemplar-props.js
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { Document } from 'yaml';

const file = new URL('../src/core/data/new_properties.xml', import.meta.url);
const contents = fs.readFileSync(file);
const jsdom = new JSDOM(contents, {
	contentType: 'text/xml;utf8',
});
const { document } = jsdom.window;
const obj = {};
const props = document.querySelectorAll('ExemplarProperties > PROPERTIES > PROPERTY');
for (let prop of props) {
	let name = prop.getAttribute('Name');
	let id = +prop.getAttribute('ID');
	let count = +prop.getAttribute('Count');
	let standard = +prop.getAttribute('Default');
	if (!id) continue;
	let type = prop.getAttribute('Type') || 'Uint32';
	if (type === 'Float32') type = 'Float';
	if (type === 'Bool') type = 'Boolean';
	let description = prop.querySelector('HELP')?.textContent.trim();
	let options = [...prop.querySelectorAll('OPTION')].map(option => {
		let value = option.getAttribute('Value');
		if (Number.isNaN(+value)) return null;
		let name = option.getAttribute('Name');
		if (!name) return null;
		return [normalizeName(name), +value];
	}).filter(opt => !!opt);
	obj[normalizeName(name)] = {
		id,
		type,
		...count && { count },
		...description && { description },
		...options.length > 0 && { options: Object.fromEntries(options) },
		...standard && { default: standard },
	};
}

// Add memo's SubMenu stuff as well.
obj.ItemSubmenuParentId = {
	id: 0x8a2602ca,
	type: 'Uint32',
	description: 'The parent Button ID that opens the submenu this item belongs to',
	options: {
		Flora: 0x4a22ea06,
		Residential: 0x29920899,
		Commercial: 0xa998af42,
		Industrial: 0xc998af00,
		Road: 0x6999bf56,
		Highway: 0x31,
		Rail: 0x29,
		MiscTransit: 0x299237bf,
		Airport: 0xe99234b3,
		WaterTransit: 0xa99234a6,
		Power: 0x35,
		Water: 0x39,
		Garbage: 0x40,
		Police: 0x37,
		Fire: 0x38,
		Education: 0x42,
		Health: 0x89dd5405,
		Landmark: 0x09930709,
		Reward: 0x34,
		Park: 0x3,
	},
};
obj.ItemButtonClass = {
	id: 0x8a2602cc,
	type: 'Uint32',
	standard: 1,
	options: {
		SubmenuButton: 1,
		NetworkItemInSubmenu: 2,
		FloraItemInSubmenu: 4,
	},
	description: 'Required for submenu functionality, but usually should not need to be changed',
};
obj.ExemplarPatchTargets = {
	id: 0x0062e78a,
	type: 'Uint32',
	count: -2,
	description: 'A list of Exemplar files this patch applies to (format: Group ID 1, Instance ID 1, Group ID 2, Instance ID 2, ...). The list must contain an even number of IDs',
};

// Serialize to yaml, but make sure to transform to an *array*.
let array = Object.entries(obj).map(([name, obj]) => {
	return { name, ...obj };
});
let doc = new Document(array);
for (let item of doc.contents.items) {
	item.get('id', true).format = 'HEX';
	let options = item.get('options', true);
	if (options) {
		for (let option of options.items) {
			option.value.format = 'HEX';
		}
	}
}

fs.writeFileSync(
	new URL('../src/core/data/new-properties.yaml', import.meta.url),
	doc.toString(),
);

function normalizeName(str) {
	let normalized = str
		.replaceAll(/^\d - /g, '')
		.replaceAll(/(\d)-(\d)/g, '$1_$2')
		.replaceAll(/:/g, ' ')
		.replaceAll(/§/g, '$')
		.trim()
		.replaceAll(/[^\w$ ]/g, '');
	return toPascalCase(normalized).replace(/^KSC4/g, 'kSC4');
}

function toPascalCase(text) {
	return text
		.split(' ')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join('');
}
