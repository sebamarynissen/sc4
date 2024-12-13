// # track.js
import chalk from 'chalk';
import { Glob } from 'glob';
import path from 'node:path';
import fs from 'node:fs';
import { DBPF, FileType, LotObjectType, ExemplarProperty, Exemplar, LotObject, Cohort } from 'sc4/core';
import { hex } from 'sc4/utils';
import PluginIndex from './plugin-index.js';
import FileScanner from './file-scanner.js';
import folderToPackageId from './folder-to-package-id.js';
import * as Dep from './dependency-types.js';
import type { Entry } from 'sc4/core';
import type { Logger, TGIQuery } from 'sc4/types';
import PQueue from 'p-queue';

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

type folder = string;
type DependencyTrackerOptions = {
	plugins?: folder;
	installation?: folder;
	logger?: Logger;
	cache?: string;
};
type PackageIndex = {
	[pkg: string]: folder;
};
type ExemplarLike = Exemplar | Cohort;
type ExemplarEntry = Entry<ExemplarLike>;

// # DependencyTracker
// Small helper class that allows us to easily pass context around without 
// having to inject it constantly in the functions.
export default class DependencyTracker {
	plugins: folder | undefined = '';
	installation: folder | undefined = '';
	logger: Logger | undefined;
	index: PluginIndex;
	packages: PackageIndex | null = null;
	options: DependencyTrackerOptions = {};
	private [kIndex]?: Promise<any>;
	private [kPackageIndex]?: Promise<any>;

	// ## constructor(opts)
	constructor(opts: DependencyTrackerOptions = {}) {
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
	async buildIndex(opts: { logger?: Logger } = {}) {

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
		let map: PackageIndex = this.packages = {};
		let glob = new Glob('*/*/', {
			cwd: this.plugins,
			absolute: true,
		});
		for await (let folder of glob) {
			if (!folder.endsWith('.sc4pac')) continue;
			let pkg = folderToPackageId(folder);
			if (pkg) {
				map[pkg] = folder;
			}
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
	async track(patterns: string | string[] = []) {

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
type MaybePromise<T> = T | Promise<T>;
class DependencyTrackingContext {
	tracker: DependencyTracker;
	index: PluginIndex;
	files: string[];
	entries: Map<string, MaybePromise<Dep.Dependency>> = new Map();
	touched: Set<string> = new Set();
	missing: object[] = [];
	queue: PQueue;

	// ## constructor(tracker, files)
	constructor(tracker: DependencyTracker, files: string[]) {
		this.tracker = tracker;
		this.index = tracker.index;
		this.files = files;

		// Setup up a promise queue so that we're able to easily throttle the 
		// amount of read operations, and even make it possible to do it all 
		// sequentially with no parallelization - which is useful for debugging 
		// purposes as it guaranteeds deterministic read order!
		this.queue = new PQueue({
			concurrency: 500,
		});

	}

	// ## track()
	// Starts the tracking operation. For now we perform it *sequentially*, but 
	// in the future we might want to do this in parallel!
	async track() {
		let tasks = this.files
			.filter(file => file.endsWith('.SC4Lot'))
			.map(file => this.read(file));
		await Promise.all(tasks);
		return new DependencyTrackingResult(this);
	}

	// ## touch(entry)
	// Stores that the given DBPF entry is "touched" by this tracking operation, 
	// meaning it is indeed considered a dependency.
	touch(entry: Entry) {
		let { file } = entry.dbpf;
		if (file) {
			this.touched.add(file);
		}
	}

	// ## read(file)
	// Parses the given file as a dbpf file and tracks down all dependencies.
	async read(file: string) {
		let dbpf = new DBPF({ file, parse: false });
		await dbpf.parseAsync();
		let tasks = [...dbpf].map(async entry => {
			switch (entry.type) {
				case FileType.DIR: return;
			}
			return await this.readResource(entry);
		});
		await Promise.all(tasks);
	}

	// ## readResource(entry)
	// Accepts a given DBPF file - as index entry - and then marks the dbpf it 
	// is stored in as touched. Then, if the resource hasn't been read yet, 
	// we'll also process it further and check what kind of resource we're 
	// dealing with.
	async readResource(entry: Entry): Promise<Dep.Dependency> {
		this.touch(entry);
		return await this.once(entry, async () => {
			switch (entry.type) {
				case FileType.Exemplar:
				case FileType.Cohort:
					return await this.queue.add(() => {
						return this.readExemplar(entry as ExemplarEntry);
					}) as Dep.Dependency;
				case FileType.FSH:
					return await this.queue.add(() => {
						return this.readTexture(entry);
					}) as Dep.Dependency;
				default:
					return new Dep.Raw({ entry });
			}
		});

	}

	// ## readExemplar(entry)
	// Reads & processes the exemplar file identified by the given entry. Note 
	// that the exemplar.
	async readExemplar(entry: ExemplarEntry) {
		let exemplar = await entry.readAsync();
		this.touch(entry);
		let [type] = [exemplar.get(0x10)].flat();
		let tasks = [];
		if (type === LotConfigurations) {
			tasks.push(this.readLotExemplar(exemplar, entry));
		} else {
			tasks.push(this.readRktExemplar(exemplar, entry));
		}

		// If a parent cohort exists, we'll read this one in as well. It means 
		// it gets marked as a dependency, which is what we want!
		let [t, g, i] = exemplar.parent;
		if (t+g+i !== 0) {
			let entry = this.index.find(t, g, i);
			if (entry) {
				tasks.push(this.readResource(entry));
			} else {
				tasks.push(new Dep.Missing({
					type: t,
					group: g,
					instance: i,
				}));
			}
		}
		let [dep, parent] = await Promise.all(tasks);
		if (parent) {
			(dep as Dep.Exemplar).parent = parent;
		}
		return dep;

	}

	// ## readLotExemplar(exemplar, entry)
	// Traverses all objects on the given lot exemplar and starts tracking them.
	async readLotExemplar<T extends ExemplarLike>(exemplar: T, entry: Entry<T>) {
		const lot = new Dep.Lot({
			entry,
			name: exemplar.get(ExemplarProperty.ExemplarName) ?? '',
		});
		const tasks: Promise<any>[] = exemplar.lotObjects.map(async lotObject => {
			const { type } = lotObject;
			const setter = Dep.getLotSetter(lot, type);
			if (!setter) return;
			let dep = await this.readLotObject(lotObject, entry);
			if (dep) setter(dep);
		});

		// Lots can also have a foundation exemplar. Read this as well.
		const fid = exemplar.get(ExemplarProperty.BuildingFoundation);
		if (fid) {
			let entry = this.index.find({ instance: fid });
			if (entry) {
				tasks.push(
					this.readResource(entry).then(x => lot.foundation = x),
				);
			} else {
				lot.foundation = new Dep.Missing({ instance: fid });
			}
		}
		await Promise.all(tasks);
		return lot;
	}

	// ## readLotObject(lotObject, entry)
	// Reads in a single lotObject. It's here that we look at what type of lot 
	// object we're actually dealing with.
	async readLotObject(lotObject: LotObject, entry: Entry) {
		switch (lotObject.type) {
			case LotObjectType.Building:
			case LotObjectType.Prop:
			case LotObjectType.Texture:
			case LotObjectType.Flora:
				return await this.readLotObjectIIDs(
					lotObject,
					entry as ExemplarEntry
				);
			case LotObjectType.Network:
				return await this.readLotObjectNetwork(lotObject, entry);
		}
	}

	// ## readLotObjectIIDs(lotObject, entry)
	// Tracks fown all lot objects that are of the type where we simply have to 
	// query an iid, such as props or buildings.
	async readLotObjectIIDs(lotObject: LotObject, entry: ExemplarEntry) {
		let tasks = [];
		for (let iid of lotObject.IIDs) {
			tasks.push(this.readLotObjectIID(iid, lotObject, entry));
		}

		// Note: only props can have multiple IIDs, which means they need to be 
		// randomized. Hence we'll return just the 1 item if there's indeed only 
		// 1.
		let result = await Promise.all(tasks);
		return result.length <= 1 ? result[0] : new Dep.Family(result, 0);

	}

	// ## readLotObjectIID(iid, lotObject, lotEntry)
	// Looks up all dependencies based on the lot object. Note that this differs 
	// per type! For network nodes, this is quite different than for props or 
	// buildings!
	async readLotObjectIID(
		iid: number,
		lotObject: LotObject,
		lotEntry: ExemplarEntry,
	) {

		// If we're dealing with a building, prop or flora, then it's possible 
		// that the idd actually refers to a family id.
		let tasks: Promise<Dep.Dependency>[] = [];
		let entries: Entry[] = [];
		let family: number = 0;
		switch (lotObject.type) {
			case LotObjectType.Building:
			case LotObjectType.Prop:
			case LotObjectType.Flora:
				let familyEntries = this.index.family(iid);
				if (familyEntries) {
					entries = familyEntries;
					family = iid;
				}
		}
		if (entries.length === 0) {
			entries = this.index.findAll({
				type: getFileTypeByLotObject(lotObject),
				instance: iid,
			});
		}

		// IMPORTANT! If we're reading the building of the lot, then our 
		// `findAll` might return the lot config exemplar *itself* as well!
		if (lotObject.type === LotObjectType.Building) {
			entries = entries.filter(entry => entry.id !== lotEntry.id);
		}

		// We've noticed that sometimes prop packs add props to families that 
		// are already defined in SimCity_1.dat as well. What this means is that 
		// if a family already contains props from SimCity_1.dat, then the other 
		// items in the family are actually optional! We need to reflect this 
		// somehow.
		if (family > 0) {
			let core = entries.filter(entry => {
				return entry.dbpf.file?.match(/SimCity_\d\.dat$/i);
			});
			if (core.length > 0) entries = core;
		}

		// Cool, now read in the resource and then go on.
		for (let entry of entries) {
			tasks.push(this.readResource(entry));
		}

		// If nothing was found with this instance, we have a missing dependency 
		// and we'll label it like that. Note however that water and land 
		// constraint tiles, as well as network nodes don't need to be labeled 
		// as a missing dependency.
		if (tasks.length === 0) {
			let kind = Object.keys(LotObjectType)[lotObject.type];
			this.missing.push({
				kind,
				file: lotEntry.dbpf.file,
				instance: iid,
			});
			return new Dep.Missing({ instance: iid });
		}

		// Now wait for everything to be read in and then return the dep. Could 
		// be a family as well by the way.
		let result = await Promise.all(tasks);
		if (family > 0) {
			let dep = new Dep.Family(result, family);
			return dep;
		} else {
			return result[0];
		}

	}

	// ## readLotObjectNetwork(lotObject, entry)
	// Tracks down a lot object that is a network node.
	async readLotObjectNetwork(lotObject: LotObject, _entry: Entry) {
		let tasks = [];
		if (lotObject.type === LotObject.Network) {

			// IMPORTANT! Not all network nodes have an IID set, and even if, it 
			// might be set to 0x00000000! We need to filter out those cases, 
			// otherwise we pass in a "select all" query to findAll, which we 
			// really want to avoid because then you'll suddenly be tracking 
			// dependencies for your **entire plugin folder**. That gets so 
			// worse that you get an out of memory error for JavaScript!
			let instance = lotObject.IID;
			if (!instance) return;
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
	async readRktExemplar(exemplar: ExemplarLike, entry: ExemplarEntry) {
		let dep = new Dep.Exemplar({
			entry,
			name: exemplar.get(ExemplarProperty.ExemplarName) ?? '',
			exemplarType: exemplar.get(ExemplarProperty.ExemplarType) ?? 0,
		});
		let models = [];
		for (let key of RKT) {
			let value = exemplar.value(key) as number[];
			if (!value) continue;
			if (value.length === 3) {
				models.push([...value]);
			} else if (value.length >= 8) {
				for (let i = 0; i < value.length; i += 8) {
					models.push(value.slice(i+5, i+8));
				}
			}
		}

		// All models have been collected from the exemplar - including the fact 
		// that RKT4's may refer to *multiple* models. Now let's all add them to 
		// the dep.
		let modelMap = new Map();
		let tasks = models.map(async ([type, group, instance]) => {

			// Again, don't follow zero-references.
			if (instance === 0x00) return;

			// Now look for the model exemplar, which is typically found inside 
			// an `.sc4model` file. Note that we only have to report missing 
			// dependencies when the model is not set to 0x00 - which is 
			// something that can happen apparently.
			let model = this.index.find({ type, group, instance });
			if (model) {
				await this.readResource(model);
				modelMap.set(model.id, new Dep.Model({ entry: model }));
			} else if (instance !== 0x00) {
				let missing = new Dep.Missing({ type, group, instance });
				modelMap.set(missing.id, missing);
				this.missing.push({
					kind: 'model',
					file: entry.dbpf.file,
					type,
					group,
					instance,
				});
			}

		});

		// Next we'll check for a few other things that might be referenced 
		// inside an exemplar, such as LTEXT's for UserVisibleNameKeys, 
		// ItemIcon, ...
		const props = {
			UserVisibleNameKey: { type: FileType.LTEXT },
			ItemIcon: { type: FileType.PNG, group: 0x6a386d26 },
			QueryExemplarGUID: {},
			SFXQuerySound: { type: 0x0b8d821a },
			SFXDefaultPlopSound: { type: 0x0b8d821a },
			SFXAmbienceGoodSound: { type: 0x0b8d821a },
			SFXActivateSound: { type: 0x4A4C132E },
		};
		for (let prop of Object.keys(props)) {
			let key = ExemplarProperty[prop as keyof typeof ExemplarProperty];
			let hint = props[prop as keyof typeof props];
			let value = exemplar.value(key) as number[];
			let query: TGIQuery & { instance: number };
			if (Array.isArray(value)) {
				if (value.length === 1) {
					let [instance] = value;
					query = { ...hint, instance };
				} else if (value.length === 3) {
					let [type, group, instance] = value;
					query = { ...hint, type, group, instance };
				} else {
					continue;
				}
			} else if (typeof value === 'number') {
				query = { ...hint, instance: value };
			} else {

				// It's possible that the value is a string instead of a 
				// reference to an ltext for example. In that case we don't need 
				// to look up other references obviously.
				continue;

			}

			// IMPORTANT! For some reason, we sometimes have an nullish
			// (0x00000000) iid as dependency. This does not need to be taken 
			// into account.
			if (query.instance === 0x00) continue;

			// If nothing was found, we have a missing dependency.
			entry = this.index.find(query) as ExemplarEntry;
			if (!entry) {
				dep.props.push([prop, new Dep.Missing(query)]);
			} else {
				let index = dep.props.length;

				// TypeScript complains that we can't add null, but that's only 
				// temporary, so make it work.
				dep.props.push(null as unknown as Dep.ExemplarProp);
				let task = this.readResource(entry).then(obj => {
					dep.props[index] = [prop, obj];
				});
				tasks.push(task);

			}

		}

		// Wait for all async subtasks to be finished. Once that happened, we 
		// will store all *unique* models that we found as a dep.
		await Promise.all(tasks);
		dep.models = [...modelMap.values()];
		return dep;

	}

	// ## readTexture(entry)
	async readTexture(entry: Entry) {
		return new Dep.Texture({ entry });
	}

	// ## once(entry)
	// Helper function that ensures that every unique tgi is only read once. 
	// This is needed because we might read a prop exemplar from a bare .sc4desc 
	// file, or from an .sc4lot file which then refers to the prop in the 
	// .sc4desc file.
	async once<T extends Dep.Dependency>(entry: Entry, fn: () => MaybePromise<T>): Promise<T> {
		let { id } = entry;
		if (this.entries.has(id)) {
			return this.entries.get(id) as T;
		};
		let promise = fn();
		this.entries.set(id, promise);
		return await Promise.resolve(promise).then(entry => {
			this.entries.set(id, entry);
			return entry;
		});
	}

}

// # DependencyTrackingResult
// Small class for representing a dependency tracking result.
type DependencyTrackingResultDumpOptions = {
	format?: string;
};
class DependencyTrackingResult {
	installation: folder;
	plugins: folder;
	scanned: string[];
	dependencies: Dep.Dependency[];
	tree: Dep.Dependency[];
	files: string[];
	packages: string[];
	missing: object[];

	// ## constructor(ctx)
	constructor(ctx: DependencyTrackingContext) {

		// Report the installation & plugins folder that we scanned.
		const { installation, plugins } = ctx.tracker.index.options;
		this.installation = installation as string;
		this.plugins = plugins as string;

		// Report all files that were scanned, relative to the plugins folder.
		this.scanned = ctx.files.sort();

		// Store all dependencies that were touched as a dependency class.
		this.dependencies = [...ctx.entries.values()] as Dep.Dependency[];

		// Build up the tree class from it.
		let children = new Set();
		for (let dep of this.dependencies) {
			for (let child of dep.children) {
				if (!child.entry) continue;
				children.add(child.entry.id);
			}
		}
		this.tree = this.dependencies.filter(dep => {
			if (dep.entry?.type !== FileType.Exemplar) return false;
			return !children.has(dep.entry.id);
		});

		// For the actual dependencies, we'll filter out the input files.
		let input = new Set(ctx.files);
		this.files = [...ctx.touched]
			.sort()
			.filter(file => !input.has(file));

		// Convert the folders to the packages as well.
		let packages = this.files
			.map(folder => folderToPackageId(folder))
			.filter(pkg => !!pkg);
		this.packages = [...new Set(packages)].sort() as string[];

		// Storate the information about the missing dependencies.
		this.missing = ctx.missing;

	}

	// ## dump(opts)
	// Creates a nice human-readable dump of the result. Various formats are 
	// possible.
	dump({ format = 'sc4pac' }: DependencyTrackingResultDumpOptions = {}) {

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
			let deps = this.files
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
		if (format === 'sc4pac' && this.missing.length > 0) {
			console.log(red('The following dependencies were not found:'));
			let mapped = this.missing.map((row: any) => {
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

		// If we're dealing with the tree format, log it here. Note that we will 
		// only log the *root* dependencies.
		if (format === 'tree') {
			for (let dep of this.tree) {
				console.log(String(dep));
			}
		}

	}

}

// # getFileTypeByLotObject(lotObject)
// Helper function that returns what filetypes we can look for
function getFileTypeByLotObject(lotObject: LotObject) {
	switch (lotObject.type) {
		case LotObjectType.Building:
		case LotObjectType.Prop:
		case LotObjectType.Flora:
			return FileType.Exemplar;
		case LotObjectType.Texture:
			return FileType.FSH;
	}
}

// # Hex
// Small helper class for formatting numbers as hexadecimal in the console table.
class Hex extends Number {
	[Symbol.for('nodejs.util.inspect.custom')](_depth: number, opts: any) {
		return opts.stylize(hex(+this), 'number');
	}
}
class File extends String {
	[Symbol.for('nodejs.util.inspect.custom')](_depth: number, opts: any) {
		let max = 100;
		let value = String(this);
		if (value.length > max) {
			value = '...'+value.slice(value.length-97);
		}
		return opts.stylize(value, 'special');
	}
}
