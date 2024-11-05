// # version-check.js
// Checks the Node.js version and asks users to upgrade.
'use strict';
const semver = require('semver');
if (!semver.satisfies(process.version, '>=12.20')) {
	console.log(`Please upgrade your Node.js version. You can do this on https://nodejs.org. Your current version is ${process.version}.`);
	process.exit(1);
}
