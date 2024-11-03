// # make-cohort.js
const fs = require('node:fs');
const path = require('node:path');
const glob = require('glob');
const DBPF = require('../lib/dbpf.js');
const Exemplar = require('../lib/exemplar.js');

// # random()
// Returns a random number between 0x00000001 and 0xffffffff. Useful for 
// generating unique ids.
function random() {
	return Math.floor(Math.random() * 0xffffffff) + 1;
}

// # createMenuPatch(files, menu, options = {})
async function createMenuPatch(files, menu, options = {}) {

	// Collect all [group,instance] pairs for the lots that need to be put in a 
	// submenu.
	let gis = [];
	for (let file of files) {
		let fullPath = path.resolve(process.cwd(), file);
		let dbpf = new DBPF(fs.readFileSync(fullPath));
		gis.push(...collect(dbpf));
	}

	// Create a fresh Cohort file and add the Exemplar Patch Targets 
	// (0x0062e78a) and Building Submenus (0xAA1DD399)
	let cohort = new Exemplar({ id: 'CQZB1###' });
	cohort.addProperty(0x0062e78a, gis);
	cohort.addProperty(0xAA1DD399, [menu]);

	// Create an empty dbpf and add the cohort to it, assigning it a random 
	// instance id by default.
	let dbpf = new DBPF();
	let { instance = random() } = options;
	dbpf.add([0x05342861, 0xb03697d1, instance], cohort);
	
	// Serialize and write away if the save option is set.
	if (options.save) {
		let buffer = dbpf.toBuffer();
		let { output = 'Submenu patch.dat' } = options;
		fs.writeFileSync(path.resolve(process.cwd(), output), buffer);
	}
	return dbpf;

}

// # collect(dbpf)
// Collect all [group, instance] pairs from the *building* exemplars in a dbpf 
// file that have "Item Icon" (0x8A2602B8) set, meaning they show up in a menu.
function collect(dbpf) {
	let gis = [];
	let entries = dbpf.entries.filter(entry => entry.type === 0x6534284a);
	for (let entry of entries) {

		// Check if the exemplar is a building exemplar
		let ex = entry.read();
		let isBuilding = ex.props.some(prop => 
			prop.id === 0x10 && prop.value === 0x02
		);
		if (!isBuilding) continue;

		// Ensure the exemplar has an icon set, meaning it appearrs in a menu.
		let hasIcon = ex.props.some(prop => prop.id === 0x8A2602B8);
		if (!hasIcon) continue;

		// Cool, this is an item that appears in a menu, grab its tgi and add 
		// the group and instance to what we're collecting.
		let [type, group, instance] = entry.tgi;
		gis.push(group, instance);

	}
	return gis;
}

const PLUGINS = process.env.SC4_PLUGINS || path.join(process.env.USERPROFILE, 'Documents/SimCity 4/Plugins');
const root = path.join(PLUGINS, '075-my-plugins/Belgian Roadpack 01');
let files = glob.globSync('*.dat', { cwd: root }).map(file => path.join(root, file));

createMenuPatch(files, /*0x64650DA2*/ 0x35, {
	save: true,
	output: path.join(root, 'Submenu patch.dat'),
});
