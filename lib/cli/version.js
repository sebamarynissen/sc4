// # version.js
import sea from 'node:sea';
import fs from 'node:fs';
import { packageUpSync } from 'package-up';

function getVersion() {
	if (sea.isSea()) {
		return sea.getAsset('version.txt', 'utf8');
	} else {
		const pkg = packageUpSync({ cwd: import.meta.dirname });
		return JSON.parse(fs.readFileSync(pkg)).version;
	}
}
export default getVersion();
