// # create-submenu-patch.js
import { fs, path } from 'sc4/utils';
import chalk from 'chalk';
import { DBPF, Cohort, FileType, ExemplarProperty, TGI } from 'sc4/core';
import type { Logger } from 'sc4/types';
import FileScanner from './file-scanner.js';

// # random()
// Returns a random number between 0x00000001 and 0xffffffff. Useful for 
// generating unique ids.
function random() {
	return Math.floor(Math.random() * 0xffffffff) + 1;
}

type PatchTarget = {
	tgi: TGI;
	name?: string;
};

type TargetInfo = {
	lots: PatchTarget[];
	flora: PatchTarget[];
};
type CreateMenuPatchOptions = {
	menu: number | number[];
	targets?: number[] | Partial<TargetInfo>;
	dbpfs?: DBPF[];
	files?: string[];
	save?: boolean;
	logger?: Logger;
	output?: string;
	directory?: string;
	instance?: number | undefined;
};

// # createMenuPatch(menu, globsOrFiles, options = {})
export default async function createMenuPatch(options: CreateMenuPatchOptions) {
	const patcher = new SubmenuPatcher();
	return await patcher.createPatch(options);
}

// # getPatchList(targets)
function getPatchList(targets: PatchTarget[]) {
	return targets.flatMap(({ tgi }) => [tgi.group, tgi.instance]);
}

export class SubmenuPatcher {
	directory: string;
	constructor(opts: { directory?: string } = {}) {
		if (opts.directory) this.directory = opts.directory;
	}

	// ## createPatch(options)
	async createPatch(options: CreateMenuPatchOptions) {
		// We'll first find the files to read in. This is a bit complicated because 
		// we support both globbing, or specifying files and directories explicitly.
		let {
			menu,
			directory = this.directory,
			logger,
		} = options;
		let patcher = new SubmenuPatcher();
		let targets = await patcher.findPatchTargets(options);

		// If nothing was found, log a warning.
		let { lots, flora } = targets;
		if (lots.length + flora.length === 0) {
			const { logger } = options;
			logger?.warn('No lots or flora found to put in a submenu');
			return null;
		}

		// Create a fresh Cohort file and add the Exemplar Patch Targets 
		// (0x0062e78a) and Building Submenus (0xAA1DD399)
		let dbpf = new DBPF();
		if (lots.length > 0) {
			let cohort = new Cohort();
			cohort.addProperty('ExemplarPatchTargets', getPatchList(lots));
			cohort.addProperty('BuildingSubmenus', [menu].flat());
			let { instance = random() } = options;
			dbpf.add([FileType.Cohort, 0xb03697d1, instance], cohort);
		}
		
		// Do the same for Flora.
		if (flora.length > 0) {
			let cohort = new Cohort();
			cohort.addProperty('ExemplarPatchTargets', getPatchList(flora));
			cohort.addProperty('ItemSubmenuParentId', [menu].flat().at(0)!);
			cohort.addProperty(
				'ItemButtonClass',
				ExemplarProperty.ItemButtonClass.FloraItemInSubmenu,
			);
			let tgi = TGI.random(FileType.Cohort, 0xb03697d1);
			dbpf.add(tgi, cohort);
		}

		// Serialize and write away if the save option is set.
		if (options.save) {
			let buffer = dbpf.toBuffer();
			let { output = 'Submenu patch.dat' } = options;
			let outputPath = path.resolve(directory, output);
			await fs.promises.writeFile(outputPath, buffer);
			logger?.ok(`Saved to ${outputPath}`);
		}
		return dbpf;
	}

	// ## findPatchTargets(opts)
	// Finds all exemplar patch targets as their tgi and exemplar name and 
	// report them as lots and flora.
	async findPatchTargets(
		options: CreateMenuPatchOptions
	): Promise<TargetInfo> {

		// If the group/instance pairs are directly specified as "targets" 
		// array, then we return it as is, and assume it's a "lots" array.
		if (options.targets) {
			if (Array.isArray(options.targets)) {
				let { targets } = options;
				return {
					lots: Array.from({ length: targets.length / 2 }, (_, i) => {
						return targets!.slice(2*i, 2*i+2);
					}).map(([group, instance]) => {
						return {
							tgi: new TGI(FileType.Exemplar, group, instance),
						};
					}),
					flora: [],
				};
			} else {
				return {
					lots: [],
					flora: [],
					...options.targets
				};
			}
		}

		// Check if a list of dbpfs was specified. If not, then we'll try to 
		// read in from files instead.
		let {
			logger,
			dbpfs,
			files: globsOrFiles = ['**/*'],
			directory = this.directory,
		} = options;
		if (!dbpfs) {
			if (!directory) {
				throw new TypeError(`No patch targets found. Neither a directory, dbpfs or targets list was specified!`);
			}

			// Read in all dbpfs from the files that we've collected.
			dbpfs = [];
			let glob = new FileScanner(globsOrFiles, { cwd: directory });
			let files = await glob.walk();
			for (let file of files) {

				// We won't try to read in anything else than .dat or .sc4lot 
				// files.
				let basePath = path.relative(process.cwd(), file);
				let ext = path.extname(file).toLowerCase();
				if (!(ext === '.dat' || ext.startsWith('.sc4'))) {
					logger?.info(`Skipping ${basePath}`);
					continue;
				}

				// Read in as dbpf and collect the relevant exemplars.
				logger?.info(chalk.gray(`Reading ${basePath}`));
				let buffer = await fs.promises.readFile(file);
				let dbpf = new DBPF({ buffer, file });
				dbpfs.push(dbpf);

			}

		}

		// Now that we have the list of dbpfs to read the lots from, actually 
		// collect the targets list.
		let targets: { lots: PatchTarget[], flora: PatchTarget []} = {
			lots: [],
			flora: [],
		};
		for (let dbpf of dbpfs) {
			let { lots = [], flora = [] } = collect(dbpf, logger);
			targets.lots.push(...lots);
			targets.flora.push(...flora);
		}
		return targets;
	}

}

// # collect(dbpf)
// Collect all [group, instance] pairs from the lots that appear in a lot. Note 
// that this is harder than it sounds because the properties we're looking for 
// might actually be stored in a parent cohort. We'll hence look for the 
// LotResourceKey, which is more or less guaranteed to not be stored in a parent 
// cohort - though it technically could be.
function collect(dbpf: DBPF, logger?: Logger): TargetInfo {
	let lots: PatchTarget[] = [];
	let flora: PatchTarget[] = [];
	let entries = dbpf.findAll({ type: FileType.Exemplar });
	for (let entry of entries) {
		let exemplar;
		try {
			exemplar = entry.read();
		} catch (e) {
			logger?.warn(`Failed to parse exemplar ${entry.id} from ${dbpf.file}: ${e.message}`);
			continue;
		}

		// If this is a flora exemplar, we'll put it in the flora list obviously.
		let type = exemplar.get('ExemplarType');
		if (type === ExemplarProperty.ExemplarType.Flora) {
			let name = exemplar.get('ExemplarName');
			logger?.info(
				chalk.gray(`Using ${name ?? 'Nameless flora'} (${entry.id})`),
			);
			flora.push({
				tgi: new TGI(entry.tgi),
				name,
			});
			continue;
		}

		// Check if the LotResourceKey exists.
		let lrk = exemplar.get('LotResourceKey');
		if (lrk) {
			let name = exemplar.get('ExemplarName');
			logger?.info(
				chalk.gray(`Using ${name ?? 'Nameless lot'} (${entry.id})`),
			);
			lots.push({
				tgi: new TGI(entry.tgi),
				name,
			});
			continue;
		}

	}
	return {
		lots,
		flora,
	};
}
