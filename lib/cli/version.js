// # version.js
import fs from 'node:fs';
import { packageUpSync } from 'package-up';

function getVersion() {
	if (isSea()) {
		const sea = getSea();
		return sea.getAsset('version.txt', 'utf8');
	} else {
		const pkg = packageUpSync({ cwd: import.meta.dirname });
		return JSON.parse(fs.readFileSync(pkg)).version;
	}
}

function getSea() {
	return process.getBuiltinModule('node:sea');
}

function isSea() {
	if (!globalThis.process?.getBuiltinModule) {
		return false;
	} else {
		const sea = getSea();
		return sea.isSea();
	}
}
export default getVersion();
