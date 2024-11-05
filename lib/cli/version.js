// # version.js
const sea = require('node:sea');
const fs = require('node:fs');
const find = require('pkg-up');

function getVersion() {
	if (sea.isSea()) {
		return sea.getAsset('version.txt', 'utf8');
	} else {
		return JSON.parse(fs.readFileSync(find.sync())).version;
	}
}
module.exports = getVersion();
