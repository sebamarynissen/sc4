// # track.js
import createDebug from 'debug';
import chalk from 'chalk';
import { Glob } from 'glob';
import path from 'node:path';
import fs from 'node:fs';
import {
	Cohort,
	DBPF,
	FileType,
	Exemplar,
	ExemplarProperty,
	LotObjectType,
	LotObject,
} from 'sc4/core';
import { hex } from 'sc4/utils';
import PluginIndex from './plugin-index.js';
import FileScanner from './file-scanner.js';
import folderToPackageId from './folder-to-package-id.js';
import * as Dep from './dependency-types.js';
import type { Entry, TGI } from 'sc4/core';
import type { Logger, TGIQuery } from 'sc4/types';
import PQueue from 'p-queue';
import { styleText } from 'node:util';
const debug = createDebug('sc4:plugins:tracker');

// Constants
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

const Groups = {
	LotConfigurations: 0xa8fbd372,
};

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

type TrackOptions = {
	dependencies?: string[];
};

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
		logger?.progress.start('Building plugin index');
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
				this.index = new PluginIndex().load(buffer);
				logger?.progress.succeed('Plugin index built');
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
		debug('Building plugin index');
		await index.build();
		debug('Indexing building & prop families');
		logger?.progress.update('Indexing building & prop families');
		await index.buildFamilies();
		logger?.progress.succeed();

		// If the index needs to be cached, then do it now.
		if (cache) {
			logger?.progress.start('Saving index to cache');
			const buffer = index.toBuffer();
			await fs.promises.writeFile(cache, buffer);
			logger?.progress.succeed();
		}
		debug('Index built');

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
	async track(patterns: string | string[] = [], opts: TrackOptions = {}) {

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
		debug('Going to track %d source files', sourceFiles.length);
		let ctx = new DependencyTrackingContext(this, sourceFiles, opts);
		return await ctx.track();

	}

}

// # DependencyTrackingContext
// This class is used to represent a single dependency tracking operation. It's 
// here that we keep track of what files we have already scanned while doing the 
// recursive walk.
type MaybePromise<T> = T | Promise<T>;
class DependencyTrackingContext {
	explicitDependencies: Set<string>;
	tracker: DependencyTracker;
	index: PluginIndex;
	files: string[];
	entries: Map<string, MaybePromise<Dep.Dependency>> = new Map();
	touched: Set<string> = new Set();
	missing: Dep.Missing[] = [];
	queue: PQueue;

	// ## constructor(tracker, files)
	constructor(tracker: DependencyTracker, files: string[], opts: TrackOptions) {
		this.tracker = tracker;
		this.index = tracker.index;
		this.files = files;
		this.explicitDependencies = new Set(opts.dependencies);

		// Setup up a promise queue so that we're able to easily throttle the 
		// amount of read operations.
		this.queue = new PQueue({ concurrency: 500 });

	}

	// ## findWithPriority(query, filter)
	// See #77. When querying a file by TGI, by default the plugin index will 
	// return the latest file, which could be an override of a Maxis builtin. 
	// When tracking dependencies, we don't want these overrides to be listed, 
	// as everything will work fine with just the Maxis builtins. This function 
	// automates this.
	// Note: there's another case where the priority can change! We've noticed 
	// that sometimes textures are included in a plugin that override other 
	// textures. Sometimes those textures are just included "just in case" 
	// apparently. So, any dependencies that are contained within our "input 
	// files" should get priority over external dependencies!
	findWithPriority(
		query: TGIQuery,
		filter?: (entry: Entry) => boolean,
	) {
		let entries = this.index.findAll(query);
		if (filter) entries = entries.filter(filter);
		if (entries.length > 1) {
			entries.sort((a, b) => {
				let fileA = a.dbpf.file!;
				let fileB = b.dbpf.file!;
				let hasA = this.files.includes(fileA) ? -1 : 1;
				let hasB = this.files.includes(fileB) ? -1 : 1;
				let diff = hasA - hasB;
				if (diff !== 0) return diff;

				// If haven't made a decision yet, we'll also check the 
				// *explicit* dependencies that might be specified. That way we 
				// don't report dependencies outside of the explicit 
				// dependencies, that only causes confusion.
				let pkgA = folderToPackageId(fileA) || fileA;
				let pkgB = folderToPackageId(fileB) || fileB;
				let explicitA = this.explicitDependencies.has(pkgA) ? -1 : 1;
				let explicitB = this.explicitDependencies.has(pkgB) ? -1 : 1;
				return explicitA - explicitB;

			});
		}
		return entries[0];
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
		await this.queue.add(async () => {
			debug('Reading %s', dbpf.file);
			await dbpf.parseAsync();
			debug('Read %s', dbpf.file);
		});
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
			debug('Reading entry %h', entry.tgi);
			switch (entry.type) {
				case FileType.Exemplar:
				case FileType.Cohort:
					return await this.readExemplar(entry as ExemplarEntry);
				case FileType.FSH:
					return await this.readTexture(entry);
				default:
					return new Dep.Raw({ entry });
			}
		});

	}

	// ## readExemplar(entry)
	// Reads & processes the exemplar file identified by the given entry. Note 
	// that the exemplar.
	async readExemplar(entry: ExemplarEntry) {
		let exemplar = await this.queue.add(() => entry.readAsync()) as ExemplarLike;
		this.touch(entry);
		let exemplarType = exemplar.get('ExemplarType');
		let tasks = [];
		if (exemplarType === ExemplarProperty.ExemplarType.LotConfigurations) {
			tasks.push(this.readLotExemplar(exemplar, entry));
		} else {
			tasks.push(this.readRktExemplar(exemplar, entry));
		}

		// If a parent cohort exists, we'll read this one in as well. It means 
		// it gets marked as a dependency, which is what we want!
		let [type, group, instance] = exemplar.parent;
		if (type+group+instance !== 0) {
			let child = this.findWithPriority({ type, group, instance });
			if (child) {
				tasks.push(this.readResource(child));
			} else {
				tasks.push(this.addMissing({
					resource: 'cohort',
					type,
					group,
					instance,
					parent: entry,
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
			let child = this.findWithPriority({ instance: fid });
			if (child) {
				tasks.push(
					this.readResource(child).then(x => lot.foundation = x),
				);
			} else {
				lot.foundation = this.addMissing({
					resource: 'foundation',
					instance: fid,
					parent: entry,
				});
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
		switch (lotObject.type) {
			case LotObjectType.Building:
			case LotObjectType.Prop:
			case LotObjectType.Flora:
				let tgis = this.index.getFamilyTGIs(iid);
				if (tgis.length > 0) {
					return await this.readFamily(tgis, iid);
				}
		}

		// If we reach this point, we know for sure that we're not dealing with 
		// a family. Now find the file that is referenced then by this iid - 
		// giving priority to core files, see #77 - where we make sure that we 
		// don't track ourselves if reading the building of the lot, as the 
		// LotConfigurations exemplar typically has the same IID!
		let entry = this.findWithPriority({
			type: getFileTypeByLotObject(lotObject),
			instance: iid,
		}, entry => entry.group !== Groups.LotConfigurations);

		// No entry found? Then we have a missing depnednecy and we'll label it 
		// like that. Note however that water and land 
		// constraint tiles, as well as network nodes don't need to be labeled 
		// as a missing dependency.
		if (!entry) {
			let kind = Object.keys(LotObjectType)[lotObject.type];
			return this.addMissing({
				resource: kind,
				instance: iid,
				parent: lotEntry,
			});
		} else {
			return await this.readResource(entry);
		}

	}

	// ## readFamily(tgis, family)
	// Tracks all dependencies of a family.
	async readFamily(tgis: TGI[], family: number) {
		let entries: Entry[] = [];
		let core: Entry[] = [];
		for (let tgi of tgis) {
			let entry = this.findWithPriority(tgi);
			if (entry) {
				let { file } = entry.dbpf;
				if (file?.match(/SimCity_\d\.dat/)) {
					core.push(entry);
				}
				entries.push(entry);
			}
		}

		// See #77. If this family contains both Maxis and non-Maxis props, then
		// we only need to track the Maxis props.
		if (entries.length !== core.length) {
			entries = core;
		}
		let tasks = entries.map(entry => this.readResource(entry));
		let result = await Promise.all(tasks);
		return new Dep.Family(result, family);
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
			let model = this.findWithPriority({ type, group, instance });
			if (model) {
				await this.readResource(model);
				modelMap.set(model.id, new Dep.Model({ entry: model }));
			} else if (instance !== 0x00) {
				let missing = this.addMissing({
					resource: 'model',
					type,
					group,
					instance,
					parent: entry,
				})
				modelMap.set(missing.id, missing);
			}

		});

		// Next we'll check for a few other things that might be referenced 
		// inside an exemplar, such as LTEXT's for UserVisibleNameKeys, 
		// ItemIcon, ...
		const props = {
			UserVisibleNameKey: { type: FileType.LTEXT },
			ItemDescriptionKey: { type: FileType.LTEXT },
			ItemIcon: { type: FileType.PNG, group: 0x6a386d26 },
			QueryExemplarGUID: { type: 0x00000000 },
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
			let resource = this.findWithPriority(query) as ExemplarEntry;
			if (!resource) {
				dep.props.push([prop, this.addMissing({
					resource: prop,
					parent: entry,
					...query,
				})]);
			} else {
				let index = dep.props.length;

				// TypeScript complains that we can't add null, but that's only 
				// temporary, so make it work.
				dep.props.push(null as unknown as Dep.ExemplarProp);
				let task = this.readResource(resource).then(obj => {
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

	// ## addMissing()
	// Creates a new missing dependency and registers it in our array of missing 
	// dependencies along the way.
	addMissing(opts: Dep.MissingOptions) {
		let dep = new Dep.Missing(opts);
		this.missing.push(dep);
		return dep;
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
	missing: Dep.Missing[];

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

		// Build up the dependency tree from it. We do this by filtering out all 
		// dependencies that appear as a non-root dependency.
		let children = new Set<Dep.Dependency>();
		let queue = this.dependencies.map(dep => dep.children).flat();
		while (queue.length > 0) {
			let dep = queue.shift()!;
			children.add(dep);
			queue.push(...dep.children);
		}
		this.tree = this.dependencies.filter(dep => {
			if (dep.entry?.type !== FileType.Exemplar) return false;
			return !children.has(dep);
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

		// Filter out the missing dependencies so that we can easily list them 
		// as well.
		this.missing = ctx.missing;

	}

	// ## dump(opts)
	// Creates a nice human-readable dump of the result. Various formats are 
	// possible.
	dump({ format = 'sc4pac' }: DependencyTrackingResultDumpOptions = {}) {

		// Show the installation and plugins folder.
		const { bold, cyan, red, green } = chalk;
		console.log(bold('Installation folder:'), cyan(this.installation));
		console.log(bold('Plugins folder:'), cyan(this.plugins));

		// Show the dependencies in sc4pac format.
		if (format === 'sc4pac') {
			if (this.packages.length > 0) {
				console.log(bold('sc4pac dependencies:'));
				for (let pkg of this.packages) {
					console.log(`  - ${cyan(pkg)}`);
				}
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

			if (deps.length > 0) {
				console.log(bold('Other dependencies:'));
				for (let dep of deps) {
					console.log(`  - ${cyan(dep)}`);
				}
			}

			// If there are no dependencies at all, make sure to log it too.
			if (this.packages.length + deps.length + this.missing.length === 0) {
				console.log(green('No external dependencies'));
			}

		}

		// Always report any missing dependencies.
		if (format === 'sc4pac' && this.missing.length > 0) {
			console.log(red('The following dependencies were not found:'));

			// We'll filter out duplicate missing dependencies based on a hash. 
			// That way, if a lot uses a missing prop 500 times, you won't get 
			// to see the missing dependency 500 times, but only *once* per lot.
			let hashes = new Set();
			let missing = [...this.missing]
				.sort((a, b) => {
					return a.resource < b.resource ? -1 : 1;
				})
				.filter(dep => {
					let { type = -1, group = -1, instance = -1 } = dep.entry;
					let { parent } = dep;
					let hash = [
						dep.resource,
						type,
						group,
						instance,
						parent.id,
					].join('/');
					if (hashes.has(hash)) {
						return false;
					} else {
						hashes.add(hash);
						return true;
					}
				});

			// Next we'll group the missing dependencies again based on another 
			// hash so that we can filter out duplicate references when 
			// generating the rows to be included in the table.
			let grouped = Object.groupBy(missing, dep => {
				let { type = -1, group = -1, instance = -1 } = dep.entry;
				return [dep.resource, type, group, instance].join('/');
			});
			let flat = [];
			for (let hash of Object.keys(grouped)) {
				let deps = grouped[hash]!;
				for (let i = 0; i < deps.length; i++) {
					let missing = deps[i];
					let { entry } = missing;
					let row: any = {};
					let u = void 0;
					if (i === 0) {
						row.kind = new Resource(missing.resource);
						entry.type !== u && (row.type = new Hex(entry.type));
						entry.group !== u && (row.group = new Hex(entry.group));
						entry.instance !== u && (row.instance = new Hex(entry.instance));
					}
					row['referenced by'] = new TableTGI(missing.parent.tgi);
					if (missing.parent.dbpf.file) row.file = new File(missing.parent.dbpf.file);
					flat.push(row);
				}
			}
			console.table(flat);
		}

		// If we're dealing with the tree format, log it here. Note that we will 
		// only log the *root* dependencies.
		if (format === 'tree') {
			for (let dep of this.tree) {
				console.log(String(dep));
			}
		}
		console.log('');

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
		let max = 64;
		let value = String(this);
		if (value.length > max) {
			value = '...'+value.slice(value.length-(max-3));
		}
		return opts.stylize(value, 'special');
	}
}
class TableTGI {
	tgi: TGI;
	constructor(tgi: TGI) {
		this.tgi = tgi;
	}
	[Symbol.for('nodejs.util.inspect.custom')](_depth: number, opts: any) {
		return this.tgi.map(nr => {
			return opts.stylize(hex(+nr), 'number');
		}).join('-');
	}
}
class Resource extends String {
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return styleText('green', String(this));
	}
}
