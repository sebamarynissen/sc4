// # file-scanner.js
import path from 'node:path';
import { Glob } from 'glob';

// # FileScanner
// Helper class that extends a Glob class. It automatically constructs globbing 
// patterns based on some extended syntax, where we support absolute paths as 
// well.
export default class FileScanner extends Glob {

	// ## constructor(patterns, opts)
	constructor(patterns, opts = {}) {
		const {
			recursive = true,
			extensions = ['dat', 'sc4lot', 'sc4desc', 'sc4model'],
			...rest
		} = opts;
		let suffix = extensions ? `.{${extensions.join(',')}}` : '';
		let rec = recursive ? '**/*' : '*';
		let parsed = [patterns].flat().map(pattern => {

			// In case we're dealing with an undefined pattern - for example 
			// process.env.SC4_INSTALLATION is not defined, then just filter it 
			// out.
			if (pattern === undefined) return false;

			// If the pattern ends with a "/" or a "\", then we'll assume it's a 
			// directory.
			if (pattern.endsWith('/') || pattern.endsWith('\\')) {
				return `${pattern}${rec}${suffix}`;
			}

			// If the pattern includes a :, then we assume we're looking for an 
			// sc4pac package.
			let name = pattern.replace(/^[A-Z]:/i, '');
			if (name.includes(':')) {
				let [pkg, rest = ''] = pattern.split('/');
				let [group, name] = pkg.split(':');
				let folder = `[0-9][0-9][0,2,4,6,8]-*/${group}.${name}.*.sc4pac/`;
				if (rest) {
					let part = `${folder}${rest}`;
					if (rest.endsWith('/*')) {
						return `${part}${suffix}`;
					} else {
						return part;
					}
				} else {
					return `${folder}${rec}${suffix}`;
				}
			}

			// If the pattern does not include * or **, we're going to treat it 
			// as either a file or a directory. We can't tell based on the path 
			// alone, but we'll use some heuristics that are good enough for our 
			// cases to determine whether it is a file or a directory. 
			// Directories will then be added as a pattern based on the 
			// recursive options. Note that sc4pac folders also end with
			if (!/[*{}!]/.test(pattern)) {
				let ext = path.extname(pattern);
				if (ext === '' || ext === '.sc4pac') {
					return `${pattern}/${recursive ? '**/*' : '*'}${suffix}`;
				} else {
					return pattern;
				}
			}

			// If the pattern is an actual globbing pattern, then we'll mostly 
			// return it as is, but also still apply the extensions suffix.
			if (pattern.endsWith('/*') || pattern === '*') {
				return `${pattern}${suffix}`;
			}
			return pattern;

		}).filter(Boolean);
		super(parsed, {
			absolute: true,
			nodir: true,
			nocase: true,
			...rest,
		});
	}

}
