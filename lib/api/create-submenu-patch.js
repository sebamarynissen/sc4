// # create-submenu-patch.js
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { Glob } from 'glob';
import { DBPF, Cohort, FileType } from 'sc4/core';

// # random()
// Returns a random number between 0x00000001 and 0xffffffff. Useful for 
// generating unique ids.
function random() {
	return Math.floor(Math.random() * 0xffffffff) + 1;
}

// # createMenuPatch(menu, globsOrFiles, options = {})
export default async function createMenuPatch(menu, globsOrFiles, options = {}) {

	// We'll first find the files to read in. This is a bit complicated because 
	// we support both globbing, or specifying files and directories explicitly.
	let {
		directory = process.cwd(),
		recursive = false,
	} = options;
	let files = new Set();
	for (let pattern of globsOrFiles) {
		let fullPath = path.resolve(directory, pattern);
		if (fs.existsSync(fullPath)) {
			let info = fs.statSync(fullPath);
			if (info.isDirectory()) {
				let localPattern = (recursive ? '**/*' : '*')+'.{dat,sc4*}';
				for await (let file of new Glob(localPattern, {
					nodir: true,
					absolute: true,
					cwd: fullPath,
				})) files.add(file);
			} else {
				files.add(fullPath);
			}
		} else {
			for await (let file of new Glob(pattern, {
				nodir: true,
				absolute: true,
				cwd: directory,
			})) files.add(file);
		}
	}

	// Collect all [group,instance] pairs for the lots that need to be put in a 
	// submenu.
	const { logger } = options;
	let gis = [];
	for (let file of files) {

		// We won't try to read in anything else than .dat or .sc4lot files.
		let fullPath = path.resolve(process.cwd(), file);
		let basePath = path.relative(process.cwd(), fullPath);
		let ext = path.extname(fullPath).toLowerCase();
		if (!(ext === '.dat' || ext.startsWith('.sc4'))) {
			logger?.info(`Skipping ${basePath}`);
			continue;
		}

		// Read in as dbpf and collect the relevant exemplars.
		logger?.info(chalk.gray(`Reading ${basePath}`));
		let dbpf = new DBPF(fs.readFileSync(fullPath));
		gis.push(...collect(dbpf, logger));

	}

	// If nothing was found, log a warning.
	if (gis.length === 0) {
		const { logger } = options;
		logger?.warn('No lots found to put in a submenu');
		return null;
	}

	// Create a fresh Cohort file and add the Exemplar Patch Targets 
	// (0x0062e78a) and Building Submenus (0xAA1DD399)
	let cohort = new Cohort();
	cohort.addProperty(0x0062e78a, gis);
	cohort.addProperty(0xAA1DD399, [menu]);

	// Create an empty dbpf and add the cohort to it, assigning it a random 
	// instance id by default.
	let dbpf = new DBPF();
	let { instance = random() } = options;
	dbpf.add([FileType.Cohort, 0xb03697d1, instance], cohort);
	
	// Serialize and write away if the save option is set.
	if (options.save) {
		let buffer = dbpf.toBuffer();
		let { output = 'Submenu patch.dat' } = options;
		let outputPath = path.resolve(directory, output);
		fs.writeFileSync(outputPath, buffer);
		logger?.ok(`Saved to ${outputPath}`);
	}
	return dbpf;

}

// # collect(dbpf)
// Collect all [group, instance] pairs from the lots that appear in a lot. Note 
// that this is harder than it sounds because the properties we're looking for 
// might actually be stored in a parent cohort. We'll hence look for the 
// LotResourceKey, which is more or less guaranteed to not be stored in a parent 
// cohort - though it technically could be.
function collect(dbpf, logger) {
	let gis = [];
	let entries = dbpf.entries.filter(entry => entry.type === FileType.Exemplar);
	for (let entry of entries) {
		
		// Check if the LotResourceKey exists.
		let ex = entry.read();
		let hasLotResourceKey = ex.props.some(prop => prop.id === 0xea260589);
		if (!hasLotResourceKey) continue;

		// Cool, this is an item that appears in a menu, grab its tgi and add 
		// the group and instance to what we're collecting.
		let [, group, instance] = entry.tgi;
		gis.push(group, instance);

		// In this case we'll also log the name of the lot we're adding.
		let nameProp = ex.props.find(prop => prop.id === 0x20) || {};
		let name = nameProp.value || 'Lot without a name';
		logger?.info(chalk.gray(`Using ${name} (${entry.id})`));

	}
	return gis;
}
