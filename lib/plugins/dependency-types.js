// # dependency-types.js
import chalk from 'chalk';
import path from 'node:path';
import { util, inspect, hex } from 'sc4/utils';
import { LotObjectType, FileType } from 'sc4/core';

const DEFAULT_WIDTH = 150;

// # Dependency
class Dependency {
	entry = null;
	constructor({ entry }) {
		this.entry = entry;
	}
	toString(opts = {}) {
		return this.toLines(opts).join('\n');
	}
}

// # Lot
// Represents a lot in the dependency tree.
export class Lot extends Dependency {
	name = '';
	foundation = null;
	building = null;
	textures = [];
	props = [];
	flora = [];
	parent = null;

	// ## constructor(opts)
	constructor(opts) {
		super(opts);
		Object.assign(this, opts);
	}

	// ## toLines()
	toLines(opts = {}) {
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
				entry.dbpf.file,
			),
		);
		let { building, textures, props, flora, parent } = this;
		let s = ' '.repeat(2*(level+1));
		level += 2;
		lines.push(
			`${s}${chalk.green('Building')}`,
			...building.toLines({ width, level, root: false }),
		);
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

	[inspect.symbol](level, opts, nodeInspect) {
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
export const getLotSetter = (lot, type) => {
	switch (type) {
		case LotObjectType.Building:
			return object => lot.building = object;
		case LotObjectType.Texture:
			return getArraySetter(lot.textures);
		case LotObjectType.Prop:
			return getArraySetter(lot.props);
		case LotObjectType.Flora:
			return getArraySetter(lot.flora);
	}
};

// # getArraySetter(array)
const getArraySetter = array => {
	const index = array.length;
	array.push(null);
	return object => array[index] = object;
};

// # Family
// Represents a family in the dependency tree. Note that this could be a 
// building, prop or flora family, but we don't make an explicit distinction 
// here.
export class Family {}

// # Texture
// Represents a texture in the dependency tree.
export class Texture extends Dependency {
	toLines({ width = DEFAULT_WIDTH, level = 0, root = true }) {
		let s = ' '.repeat(2*level);
		let l = root ? chalk.magenta('Texture ') : '';
		return [$(
			width,
			`${s}${l}${chalk.yellow(hex(this.entry.instance))}`,
			this.entry.dbpf.file,
		)];
	}
	[inspect.symbol](level, opts, nodeInspect) {
		return inspect.tgi(this.entry, 'Texture');
	}
}

// # Model
// Represents a model in the dependency tree.
export class Model extends Dependency {

	// ## toLines()
	toLines({ width = DEFAULT_WIDTH, level = 0 } = {}) {
		let { entry } = this;
		let lines = [];
		lines.push($(
			width,
			`${' '.repeat(2*level)}Model ${entryToString(entry)}`,
			entry.dbpf.file,
		));
		return lines;
	}

	[inspect.symbol](level, opts, nodeInspect) {
		return inspect.tgi(this.entry, 'Model');
	}
}

// # Exemplar
// Represents a generic exemplar in the dependency tree. This could be a 
// building exemplar, prop exemplar, whatever.
export class Exemplar extends Dependency {
	name = '';
	parent = null;
	model = null;
	props = [];

	// ## constructor(opts)
	constructor(opts) {
		super(opts);
		Object.assign(this, opts);
	}

	// ## toLines(opts)
	toLines({ width = DEFAULT_WIDTH, level = 0, root = true } = {}) {
		let lines = [];
		let { name, entry } = this;
		if (root) {
			lines.push(chalk.magenta('Exemplar'));
		}
		lines.push($(
			width,
			`${' '.repeat(2*level)}${name} ${entryToString(entry)}`,
			entry.dbpf.file,
		));
		if (this.model) {
			lines.push(...this.model.toLines({ width, level: level+1 }));
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

	[inspect.symbol](level, opts, nodeInspect) {
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
	get label() {
		return FileType[this.entry.type];
	}

	toLines({ level, width = DEFAULT_WIDTH, root = true } = {}) {
		let { type } = this.entry;
		let line = chalk.yellow(FileType[type] ?? hex(this.entry.type));
		if (root) {
			line = `${chalk.magenta('Raw')} ${line}`;
		}
		return [$(width, line, this.entry.dbpf.file)];
	}

	[inspect.symbol](level, opts, nodeInspect) {
		return inspect.tgi(this.entry, this.label);
	}
}

// # Missing
// Represents a mising dependency
export class Missing extends Dependency {
	constructor(entry) {
		super({ entry });
	}
	toLines({ level = 0 } = {}) {
		const { type, group, instance } = this.entry;
		let prefix = `${' '.repeat(2*level)} ${chalk.red('MISSING')}`;
		if (!type) {
			return [`${prefix}${chalk.yellow(prefix)}`];
		} else {
			let tgi = [type, group, instance].map(x => chalk.yellow(hex(x)));
			return [`${prefix} ${tgi}`];
		}
	}
	[inspect.symbol]() {
		return inspect.tgi(this.entry, util.styleText('red', 'MISSING'));
	}
}

// # entryToString(entry)
function entryToString({ type, group, instance }) {
	if (!group) {
		return chalk.yellow(hex(instance));
	}
	return [type, group, instance].map(nr => {
		return chalk.yellow(hex(nr));
	}).join('-');
}

function $(width, line, file) {
	// eslint-disable-next-line no-control-regex
	let filtered = line.replaceAll(/\x1B\[\d+m/g, '');
	let basename = file ? path.basename(file) : 'Not found';
	let spaces = ' '.repeat(Math.max(width - basename.length - filtered.length, 0));
	return `${line}${spaces}${chalk[file ? 'cyan' : 'red'](basename)}`;
}
