// # version.js
import sea from 'node:sea';
import fs from 'node:fs';
import find from 'pkg-up';

function getVersion() {
	if (sea.isSea()) {
		return sea.getAsset('version.txt', 'utf8');
	} else {
		return JSON.parse(fs.readFileSync(find.sync())).version;
	}
}
export default getVersion();
