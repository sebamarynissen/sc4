// # track.js
import chalk from 'chalk';
import { Glob } from 'glob';
import path from 'node:path';
import fs from 'node:fs';
import { DBPF, FileType } from 'sc4/core';
import { hex } from 'sc4/utils';
import PluginIndex from './plugin-index.js';
import FileScanner from './file-scanner.js';

// Constants
const LotConfigurations = 0x00000010;
const RKT = [
	0x27812820,
	0x27812821,
	0x27812822,
	0x27812823,
	0x27812824,
	0x27812825,
	0x27812921,
	0x27812922,
	0x27812923,
	0x27812924,
	0x27812925,
];

const kIndex = Symbol('index');
const kPackageIndex = Symbol('packageIndex');

// # DependencyTracker
// Small helper class that allows us to easily pass context around without 
// having to inject it constantly in the functions.
export default class DependencyTracker {

	plugins = '';
	installation = '';
	index = null;
	packages = null;
	options = {};

	// ## constructor(opts)
	constructor(opts = {}) {
		this.options = { ...opts };
		const {
			plugins = process.env.SC4_PLUGINS,
			installation = process.env.SC4_INSTALLATION,
			logger,
		} = this.options;
		this.plugins = plugins;
		this.installation = installation;
		this.logger = logger;
	}

	// ## buildIndex()
	// Builds up the index of all available files by TGI, just like SimCity 4 
	// does it upon loading, taking into account any overrides.
	async buildIndex(opts = {}) {

		// If a dependency cache was specified, check if it exists.
		const { logger = this.logger } = opts;
		logger?.step('Building plugin index');
		let { cache } = this.options;
		if (cache) {
			let buffer;
			try {
				buffer = await fs.promises.readFile(cache);
			} catch (e) {
				if (e.code !== 'ENOENT') throw e;
			}

			// If a cached file was found, read from there.
			if (buffer) {
				const json = JSON.parse(buffer.toString());
				this.index = await new PluginIndex().load(json);
				logger?.succeed('Plugin index built');
				return;
			}

		}

		// If we reach this point, we can't read the index from a cache, so we 
		// have to parse it ourselves.
		const { plugins, installation } = this;
		const index = this.index = new PluginIndex({
			plugins,
			installation,
		});
		await index.build();
		logger?.progress('Indexing building & prop families');
		await index.buildFamilies();
		logger?.succeed();

		// If the index needs to be cached, then do it now.
		if (cache) {
			logger?.step('Saving index to cache');
			await fs.promises.writeFile(cache, JSON.stringify(index.toJSON()));
			logger?.succeed();
		}

	}

	// ## ensureIndex()
	// Call this to ensure that our file index is only built once.
	async ensureIndex() {
		if (this.index) return this.index;
		let promise = this[kIndex];
		if (promise) return promise;

		// If the index has never been built, do it now.
		promise = this[kIndex] = this.buildIndex().then(() => {
			delete this[kIndex];
		});
		await promise;

	}

	// ## buildPackageIndex()
	// Builds up the index of all installed sc4pac packages. We do this based on 
	// the folder structure of the plugins folder.
	async buildPackageIndex() {
		let map = this.packages = {};
		let glob = new Glob('*/*/', {
			cwd: this.plugins,
			absolute: true,
		});
		for await (let folder of glob) {
			if (!folder.endsWith('.sc4pac')) continue;
			let pkg = folderToPackageId(folder);
			map[pkg] = folder;
		}
	}

	// ## ensurePackageIndex()
	// Call this to ensure that our package index is only built once.
	async ensurePackageIndex() {
		if (this.packages) return this.packages;
		let promise = this[kPackageIndex];
		if (promise) return promise;

		// If the index has never been built, do it now.
		promise = this[kPackageIndex] = this.buildPackageIndex().then(() => {
			delete this[kPackageIndex];
		});
		await promise;

	}

	// ## track(patterns)
	// Performs the actual dependency tracking. Returns an array of filenames 
	// that are needed by the source files.
	async track(patterns = []) {

		// If the index hasn't been built yet, we'll do this first. The index is 
		// stored per instance so that we can track dependencies multiple times 
		// with the same instance, which is way faster.
		let indexPromise = this.ensureIndex();
		let packagePromise = this.ensurePackageIndex();

		// Next we'll actually collect the source files. We do this by looping 
		// all the input and check whether it is a directory or not.
		let filesPromise = new FileScanner(patterns, {
			cwd: this.plugins,
		}).walk();
		const [sourceFiles] = await Promise.all([
			filesPromise,
			indexPromise,
			packagePromise,
		]);

		// Now actually start tracking, but do it in a separate context.
		let ctx = new DependencyTrackingContext(this, sourceFiles);
		return await ctx.track();

	}

}

// # DependencyTrackingContext
// This class is used to represent a single dependency tracking operation. It's 
// here that we keep track of what files we have already scanned while doing the 
// recursive walk.
class DependencyTrackingContext {

	had = new Map();
	touched = new Set();
	missing = [];

	// ## constructor(tracker, files)
	constructor(tracker, files) {
		this.tracker = tracker;
		this.index = tracker.index;
		this.files = files;
	}

	// ## track()
	// Starts the tracking operation. For now we perform it *sequentially*, but 
	// in the future we might want to do this in parallel!
	async track() {
		let tasks = this.files.map(file => this.read(file));
		await Promise.all(tasks);
		return new DependencyTrackingResult(this);
	}

	// ## touch(entry)
	// Stores that the given DBPF entry is "touched" by this tracking operation, 
	// meaning it is indeed considered a dependency.
	touch(entry) {
		this.touched.add(entry.dbpf.file);
	}

	// ## read(file)
	// Parses the given file as a dbpf file and tracks down all dependencies.
	async read(file) {
		let dbpf = new DBPF({ file, parse: false });
		await dbpf.parseAsync();
		let tasks = [...dbpf].map(entry => this.readResource(entry));
		await Promise.all(tasks);
	}

	// ## readResource(entry)
	// Accepts a given DBPF file - as index entry - and then marks the dbpf it 
	// is stored in as touched. Then, if the resource hasn't been read yet, 
	// we'll also process it further and check what kind of resource we're 
	// dealing with.
	async readResource(entry) {
		this.touch(entry);
		return await this.once(entry, async () => {
			switch (entry.type) {
				case FileType.Exemplar:
				case FileType.Cohort:
					await this.readExemplar(entry);
					break;
			}
		});
	}

	// ## readExemplar(entry)
	// Reads & processes the exemplar file identified by the given entry. Note 
	// that the exemplar.
	async readExemplar(entry) {
		let exemplar = await entry.readAsync();
		this.touch(entry);
		let [type] = [exemplar.value(0x10)].flat();
		let tasks = [];
		if (type === LotConfigurations) {
			tasks.push(this.readLotExemplar(exemplar, entry));
		} else {
			tasks.push(this.readRktExemplar(exemplar, entry));
		}

		// If a parent cohorot exists, we'll read this one in as well. It means 
		// it gets marked as a dependency, which is what we want!
		let [t, g, i] = exemplar.parent;
		if (t+g+i !== 0) {
			let entry = this.index.find(t, g, i);
			tasks.push(this.readResource(entry));
		}
		await Promise.all(tasks);

	}

	// ## readLotExemplar(exemplar, entry)
	// Traverses all objects on the given lot exemplar and starts tracking them.
	async readLotExemplar(exemplar, entry) {
		let tasks = [];
		for (let lotObject of exemplar.lotObjects) {
			tasks.push(this.readLotObject(lotObject, entry));
		}
		await Promise.all(tasks);
	}

	// ## readLotObject(lotObject, entry)
	// Reads in a single lotObject. It's here that we look at what type of lot 
	// object we're actually dealing with.
	async readLotObject(lotObject, entry) {
		switch (lotObject.type) {
			case LotObject.Building:
			case LotObject.Prop:
			case LotObject.Texture:
			case LotObject.Flora:
				return await this.readLotObjectIIDs(lotObject, entry);
			case LotObject.Network:
				return await this.readLotObjectNetwork(lotObject, entry);
		}
	}

	// ## readLotObjectIIDs(lotObject, entry)
	// Tracks fown all lot objects that are of the type where we simply have to 
	// query an iid, such as props or buildings.
	async readLotObjectIIDs(lotObject, entry) {
		let tasks = [];
		for (let iid of lotObject.IIDs) {
			tasks.push(this.readLotObjectIID(iid, lotObject, entry));
		}
		await Promise.all(tasks);
	}

	// ## readLotObjectIID(iid, lotObject, entry)
	// Looks up all dependencies based on the lot object. Note that this differs 
	// per type! For network nodes, this is quite different than for props or 
	// buildings!
	async readLotObjectIID(iid, lotObject, entry) {
		let tasks = [];
		let family = this.index.family(iid);
		if (family) {
			for (let entry of family) {
				tasks.push(this.readResource(entry));
			}
		} else {
			let entries = this.index.findAll({ instance: iid });
			for (let entry of entries) {
				tasks.push(this.readResource(entry));
			}
		}

		// If nothing was found with this instance, we have a missing dependency 
		// and we'll label it like that. Note however that water and land 
		// constraint tiles, as well as network nodes don't need to be labeled 
		// as a missing dependency.
		if (tasks.length === 0) {
			let kind = LotObjectTypes[lotObject.type];
			if (kind) {
				this.missing.push({
					kind,
					file: entry.dbpf.file,
					instance: iid,
				});
			}
		} else {
			await Promise.all(tasks);
		}

	}

	// ## readLotObjectNetwork(lotObject, entry)
	// Tracks down a lot object that is a network node.
	async readLotObjectNetwork(lotObject, entry) {
		let tasks = [];
		if (lotObject.values.length > 15) {
			let instance = lotObject.values[15];
			if (instance === 0x00) return;
			let entries = this.index.findAll({ instance });
			for (let entry of entries) {
				tasks.push(this.readResource(entry));
			}
		}
		await Promise.all(tasks);
	}

	// ## readRktExemplar(exemplar, entry)
	// Reads in an exemplar and looks for ResourceKeyTypes. If found, we have to 
	// mark the resource as a dependency.
	async readRktExemplar(exemplar, entry) {
		let tasks = [];
		for (let key of RKT) {
			let value = exemplar.value(key);
			if (!value) continue;
			let type, group, instance;
			if (value.length === 3) {
				[type, group, instance] = value;
			} else if (value.length >= 8) {
				[type, group, instance] = value.slice(5);
			}

			// Again, don't follow zero-references.
			if (instance === 0x00) continue;

			// Now look for the model exemplar, which is typically found inside 
			// an `.sc4model` file. Note that we only have to report missing 
			// dependencies when the model is not set to 0x00 - which is 
			// something that can happen apparently.
			let model = this.index.find({ type, group, instance });
			if (model) {
				tasks.push(this.readResource(model));
			} else if (instance !== 0x00) {
				this.missing.push({
					kind: 'model',
					file: entry.dbpf.file,
					type,
					group,
					instance,
				});
			}

		}
		await Promise.all(tasks);
	}

	// ## once(entry)
	// Helper function that ensures that every unique tgi is only read once. 
	// This is needed because we might read a prop exemplar from a bare .sc4desc 
	// file, or from an .sc4lot file which then refers to the prop in the 
	// .sc4desc file.
	async once(entry, fn) {
		let { id } = entry;

		// IMPORTANT!! DO NOT return the promise here or we risk getting stuck 
		// in a deadlock!
		if (this.had.has(id)) return;
		let promise = fn();
		this.had.set(id, promise);
		await promise;

	}

}

// # DependencyTrackingResult
// Small class for representing a dependency tracking result.
class DependencyTrackingResult {

	// ## constructor(ctx)
	constructor(ctx) {

		// Report the installation & plugins folder that we scanned.
		const { installation, plugins } = ctx.tracker.index.options;
		this.installation = installation;
		this.plugins = plugins;

		// Report all files that were scanned, relative to the plugins folder.
		this.scanned = ctx.files.sort();

		// For the actual dependencies, we'll filter out the input files.
		let input = new Set(ctx.files);
		this.dependencies = [...ctx.touched]
			.sort()
			.filter(file => !input.has(file));

		// Convert the folders to the packages as well.
		let packages = this.dependencies
			.map(folder => folderToPackageId(folder))
			.filter(Boolean);
		this.packages = [...new Set(packages)].sort();

		// Storate the information about the missing dependencies.
		this.missing = ctx.missing;

	}

	// ## dump(opts)
	// Creates a nice human-readable dump of the result. Various formats are 
	// possible.
	dump({ format = 'sc4pac' } = {}) {

		// Show the installation and plugins folder.
		const { bold, cyan, red } = chalk;
		console.log('');
		console.log(bold('Installation folder:'), cyan(this.installation));
		console.log(bold('Plugins folder:'), cyan(this.plugins));

		// Show the dependencies in sc4pac format.
		if (format === 'sc4pac') {
			console.log(bold('sc4pac dependencies:'));
			for (let pkg of this.packages) {
				console.log(`  - ${cyan(pkg)}`);
			}

			// Log all the non-sc4pac dependencies as well, but make sure that 
			// we exclude anything that's present already in sc4pac
			let deps = this.dependencies
				.filter(fullPath => {
					if (fullPath.startsWith(`${this.installation}${path.sep}`)) {
						return false;
					}
					let id = folderToPackageId(path.dirname(fullPath));
					return !id;
				})
				.map(fullPath => path.relative(this.plugins, fullPath));

			console.log(bold('Other dependencies:'));
			for (let dep of deps) {
				console.log(`  - ${cyan(dep)}`);
			}

		}

		// Always report any missing dependencies.
		if (this.missing.length > 0) {
			console.log(red('The following dependencies were not found:'));
			let mapped = this.missing.map(row => {
				let clone = { ...row };
				let u = void 0;
				row.type !== u && (clone.type = new Hex(row.type));
				row.group !== u && (clone.group = new Hex(row.group));
				row.instance !== u && (clone.instance = new Hex(row.instance));
				if (row.file) clone.file = new File(row.file);
				return clone;
			});
			console.table(mapped);
		}

	}

}

// # Hex
// Small helper class for formatting numbers as hexadecimal in the console table.
class Hex extends Number {
	[Symbol.for('nodejs.util.inspect.custom')](depth, opts) {
		return opts.stylize(hex(+this), 'number');
	}
}
class File extends String {
	[Symbol.for('nodejs.util.inspect.custom')](depth, opts) {
		let max = 100;
		let value = String(this);
		if (value.length > max) {
			value = '...'+value.slice(value.length-97);
		}
		return opts.stylize(value, 'special');
	}
}

// # folderToPackageId(folder)
// Returns the corresponding sc4pac package id from a given folder. If this is 
// not an sc4pac folder, we return nothing.
function folderToPackageId(folder) {
	let basename = path.basename(folder);
	while (!basename.endsWith('.sc4pac')) {
		folder = path.resolve(folder, '..');
		basename = path.basename(folder);
		if (!basename) return null;
	}
	let [group, name] = basename.split('.');
	return `${group}:${name}`;
}

const LotObject = {
	Building: 0x00,
	Prop: 0x01,
	Texture: 0x02,
	Fence: 0x03,
	Flora: 0x04,
	Water: 0x05,
	Land: 0x06,
	Network: 0x07,
};

const LotObjectTypes = Object.keys(LotObject).map(str => str.toLowerCase());
