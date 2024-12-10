// # folder-to-package-id.js
import path from 'node:path';

// # folderToPackageId(folder)
// Returns the corresponding sc4pac package id from a given folder. If this is 
// not an sc4pac folder, we return nothing.
export default function folderToPackageId(folder: string) {
	let basename = path.basename(folder);
	while (!basename.endsWith('.sc4pac')) {
		folder = path.resolve(folder, '..');
		basename = path.basename(folder);
		if (!basename) return null;
	}
	let [group, name] = basename.split('.');
	return `${group}:${name}`;
}
