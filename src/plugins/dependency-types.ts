// # dependency-types.js
import chalk from 'chalk';
import path from 'node:path';
import { util, inspect, hex } from 'sc4/utils';
import { LotObjectType, getTypeLabel, type Entry } from 'sc4/core';
import type { InspectOptions } from 'node:util';

const DEFAULT_WIDTH = 150;

type EntryLike = Entry | {
	type?: number;
	group?: number;
	instance: number;
	id?: string;
	dbpf?: {
		file?: string;
	};
};
type DependencyOptions = {
	entry: EntryLike;
};
type ToLinesOptions = {
	width?: number;
	level?: number;
	root?: boolean;
};

// # Dependency
export abstract class Dependency {
	entry: EntryLike;
	abstract kind: string;
	constructor({ entry }: DependencyOptions) {
		this.entry = entry;
	}
	toString(opts = {}) {
		return this.toLines(opts).join('\n');
	}
	abstract toLines(...args: any[]): string[];

	// ## get id()
	// The default dependency id is just the entry id. This is overridden though 
	// for missing dependencies as they have no entries associated with them! 
	// Same for families.
	get id() {
		return this.entry.id;
	}

	// ## get children()
	// By default a dependency has no children. If a dependency has cildren, it 
	// needs to implement it itself.
	get children(): Dependency[] {
		return [];
	}

}

// # Lot
// Represents a lot in the dependency tree.
export class Lot extends Dependency {
	kind = 'lot';
	name = '';
	foundation: Dependency | null = null;
	building: Dependency | null = null;
	textures: Dependency[] = [];
	props: Dependency[] = [];
	flora: Dependency[] = [];
	parent: Dependency | null = null;

	// ## constructor(opts)
	constructor(opts: DependencyOptions & { name: string }) {
		super(opts);
		Object.assign(this, opts);
	}

	// ## get children()
	// Returns all dependencies that are considered children of this dependency. 
	// Note that certain dependencies might actually be *families*, meaning we 
	// have to flatten the array!
	get children() {
		return [
			this.foundation,
			this.building,
			...this.textures,
			...this.props,
			...this.flora,
			this.parent,
		].flat(1).filter(dep => !!dep);
	}

	// ## toLines()
	toLines(opts: ToLinesOptions = {}) {
		let { width = DEFAULT_WIDTH, level = 0, root = true } = opts;
		let lines = [];
		let { name, entry } = this;
		if (root) {
			lines.push(chalk.magenta('Lot'));
		}
		lines.push(
			$(
				width,
				`${' '.repeat(2*level)}${name} ${entryToString(entry)}`,
				entry.dbpf?.file,
			),
		);
		let { foundation, building, textures, props, flora, parent } = this;
		let s = ' '.repeat(2*(level+1));
		level += 2;
		if (foundation) {
			lines.push(
				`${s}${chalk.green('Foundation')}`,
				...foundation.toLines({ width, level, root: false }),
			);
		}
		if (building) {
			lines.push(
				`${s}${chalk.green('Building')}`,
				...building.toLines({ width, level, root: false }),
			);
		}
		if (textures.length > 0) {
			lines.push(`${s}${chalk.green('Textures')}`);
			for (let texture of textures) {
				lines.push(...texture.toLines({ width, level, root: false }));
			}
		}
		if (props.length > 0) {
			lines.push(`${s}${chalk.green('Props')}`);
			for (let prop of props) {
				lines.push(...prop.toLines({ width, level, root: false }));
			}
		}
		if (flora.length > 0) {
			lines.push(`${s}${chalk.green('Flora')}`);
			for (let item of flora) {
				lines.push(...item.toLines({ width, level, root: false }));
			}
		}
		if (parent) {
			lines.push(`${s}${chalk.green('Parent')}`);
			lines.push(...parent.toLines({ width, level, root: false }));
		}
		if (root) {
			lines.push('');
		}
		return lines;
	}

	[Symbol.for('nodejs.util.inspect.custom')](
		_level: number,
		opts: InspectOptions,
		nodeInspect: Function
	) {
		let { entry, ...rest } = this;
		return `Lot ${nodeInspect({
			entry: inspect.tgi(entry, 'Entry'),
			...rest,
		}, opts)}`;
	}
}

// # getLotSetter(lot, type)
// Returns a setter that allows us to set a specific lot object in a deferred 
// way - i.e. further up the event loop.
export const getLotSetter = (lot: Lot, type: number) => {
	switch (type) {
		case LotObjectType.Building:
			return (object: Dependency) => lot.building = object;
		case LotObjectType.Texture:
			return getArraySetter(lot.textures);
		case LotObjectType.Prop:
			return getArraySetter(lot.props);
		case LotObjectType.Flora:
			return getArraySetter(lot.flora);
		default:
			return () => void null;
	}
};

// # getArraySetter(array)
const getArraySetter = (array: Dependency[]) => {
	return (dep: Dependency) => {
		let ids = new Set(array.map(dep => dep.id));
		if (!ids.has(dep.id)) {
			array.push(dep);
			array.sort();
		}
		return dep;
	};
};

// # Family
// Represents a family in the dependency tree. Note that this could be a 
// building, prop or flora family, but we don't make an explicit distinction 
// here.
export class Family extends Dependency {
	kind = 'family';
	familyId: number | undefined;
	elements: Dependency[];

	// ## constructor(id, children)
	constructor(children: Dependency[], id?: number) {
		let entry = { instance: id ?? 0 };
		super({ entry });
		this.elements = children;
		this.familyId = id;
	}

	// ## toLines()
	toLines({ width, level = 0 }: ToLinesOptions) {
		let line = `${' '.repeat(2*level)}${chalk.green('Family')}`;
		if (this.familyId !== undefined) {
			line += ` ${chalk.yellow(hex(this.familyId))}`;
		}
		let lines = [line];
		level += 1;
		for (let dep of this.elements) {
			lines.push(...dep.toLines({ width, level, root: false }));
		}
		return lines;
	}

	// ## get id()
	get id() {
		let id = this.familyId ?? [...this.elements]
			.map(dep => dep.id)
			.join('/');
		return `family/${id}`;
	}

	// ## get children()
	get children() {
		return this.elements;
	}

}

// # Texture
// Represents a texture in the dependency tree.
export class Texture extends Dependency {
	kind = 'texture';
	toLines({ width = DEFAULT_WIDTH, level = 0, root = true }: ToLinesOptions) {
		let s = ' '.repeat(2*level);
		let l = root ? chalk.magenta('Texture ') : '';
		return [$(
			width,
			`${s}${l}${chalk.yellow(hex(this.entry.instance))}`,
			this.entry.dbpf?.file,
		)];
	}
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return inspect.tgi(this.entry, 'Texture');
	}
}

// # Model
// Represents a model in the dependency tree.
export class Model extends Dependency {
	kind = 'model';

	// ## toLines()
	toLines({ width = DEFAULT_WIDTH, level = 0 }: ToLinesOptions = {}) {
		let { entry } = this;
		let lines = [];
		lines.push($(
			width,
			`${' '.repeat(2*level)}Model ${entryToString(entry)}`,
			entry.dbpf?.file,
		));
		return lines;
	}

	[Symbol.for('nodejs.util.inspect.custom')]() {
		return inspect.tgi(this.entry, 'Model');
	}
}

const exemplarTypes = {
	0x00: 'Other',
	0x01: 'Tuning',
	0x02: 'Buildings',
	0x03: 'RCI',
	0x04: 'Developer',
	0x05: 'Simulator',
	0x06: 'Road',
	0x07: 'Bridge',
	0x08: 'MiscNetwork',
	0x09: 'NetworkIntersection',
	0x0a: 'Rail',
	0x0B: 'Highway',
	0x0c: 'PowerLine',
	0x0d: 'Terrain',
	0x0e: 'Ordinances',
	0x0f: 'Flora',
	0x10: 'Lotconfigurations',
	0x11: 'Foundations',
	0x12: 'Advice',
	0x13: 'Lighting',
	0x14: 'Cursor',
	0x15: 'LotReainingWalls',
	0x16: 'Vehicles',
	0x17: 'Pedestrians',
	0x18: 'Aircraft',
	0x19: 'Watercraft',
	0x1e: 'Prop',
	0x1f: 'Construction',
	0x20: 'Automata Tuning',
	0x21: 'Type 21',
	0x22: 'Disaster',
	0x23: 'Data view',
	0x24: 'Crime',
	0x25: 'Audio',
	0x26: 'My Sim Template',
	0x27: 'TerrainBrush',
	0x28: 'Misc Catalog',
};

// # Exemplar
// Represents a generic exemplar in the dependency tree. This could be a 
// building exemplar, prop exemplar, whatever.
export type ExemplarProp = [name: string, dep: Dependency];
export class Exemplar extends Dependency {
	kind = 'exemplar';
	exemplarType: keyof typeof exemplarTypes = 0x00;
	name = '';
	parent: Dependency | null = null;
	models: Dependency[] = [];
	props: ExemplarProp[] = [];

	// ## constructor(opts)
	constructor(opts: DependencyOptions & { exemplarType: number; name: string }) {
		super(opts);
		Object.assign(this, opts);
	}

	// ## get children()
	get children() {
		return [
			...this.models,
			this.parent,
			...this.props.map(row => (row as ExemplarProp)[1]),
		].filter(dep => !!dep);
	}

	// ## toLines(opts)
	toLines({ width = DEFAULT_WIDTH, level = 0, root = true }: ToLinesOptions = {}) {
		let lines = [];
		let { name, entry } = this;
		if (root) {
			let type = exemplarTypes[this.exemplarType];
			lines.push(`${chalk.magenta('Exemplar')} ${chalk.gray(`(${type})`)}`);
		}
		lines.push($(
			width,
			`${' '.repeat(2*level)}${name} ${entryToString(entry)}`,
			entry.dbpf?.file,
		));
		if (this.models.length > 0) {
			for (let model of this.models) {
				lines.push(...model.toLines({ width, level: level+1 }));
			}
		}
		for (let [name, { entry }] of this.props) {
			if (!entry) continue;
			lines.push($(
				width,
				`${' '.repeat(2*(level+1))}${name} ${entryToString(entry)}`,
				entry.dbpf?.file,
			));
		}
		if (this.parent) {
			lines.push(...this.parent.toLines({ width, level: level+1 }));
		}
		if (root) lines.push('');
		return lines;
	}

	[Symbol.for('nodejs.util.inspect.custom')](
		_level: number,
		opts: InspectOptions,
		nodeInspect: any,
	) {
		let { entry, ...rest } = this;
		return `Exemplar ${nodeInspect({
			entry: inspect.tgi(entry, 'Entry'),
			...rest,
		}, opts)}`;
	}
}

// # Raw
// Represents a raw resource in the dependency tree. This means that all we do 
// here is show the tgi. There's no need to parse anything in the resource 
// itself because it can't reference others.
export class Raw extends Dependency {
	kind = 'raw';
	get label() {
		return getTypeLabel(this.entry.type!);
	}

	toLines({ width = DEFAULT_WIDTH, root = true }: ToLinesOptions = {}) {
		let line = chalk.yellow(this.label ?? hex(this.entry.type!));
		if (root) {
			line = `${chalk.magenta('Raw')} ${line}`;
		}
		return [$(width, line, this.entry.dbpf?.file)];
	}

	[Symbol.for('nodejs.util.inspect.custom')]() {
		return inspect.tgi(this.entry, this.label);
	}
}

// # Missing
// Represents a mising dependency
export class Missing extends Dependency {
	kind = 'missing';
	constructor(entry: EntryLike) {
		super({ entry });
	}
	toLines({ width = DEFAULT_WIDTH, level = 0 }: ToLinesOptions = {}) {
		const { type, group, instance } = this.entry;
		let prefix = `${' '.repeat(2*level)}`;
		if (!type) {
			return [$(
				width,
				`${prefix}${chalk.yellow(hex(instance))}`,
			)];
		} else if (instance && group) {
			let tgi = [type, group, instance].map(x => chalk.yellow(hex(x)));
			return [$(
				width,
				`${prefix}${tgi}`,
			)];
		} else {
			return [];
		}
	}
	get id() {
		const { type = 0, group = 0, instance = 0 } = this.entry;
		return `missing/${type}-${group}-${instance}`;
	}
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return inspect.tgi(this.entry, util!.styleText('red', 'MISSING'));
	}
}

// # entryToString(entry)
function entryToString({ type, group, instance }: EntryLike) {
	if (!group) {
		return chalk.yellow(hex(instance));
	}
	if (type === undefined) {
		return chalk.yellow(hex(instance));
	} else {
		return [type, group, instance].map(nr => {
			return chalk.yellow(hex(nr));
		}).join('-');
	}
}

function $(width: number, line: string, file?: string | null | undefined) {
	// eslint-disable-next-line no-control-regex
	let filtered = line.replaceAll(/\x1B\[\d+m/g, '');
	let basename = file ? path.basename(file) : 'Not found';
	let spaces = ' '.repeat(Math.max(width - basename.length - filtered.length, 0));
	return `${line}${spaces}${chalk[file ? 'cyan' : 'red'](basename)}`;
}
