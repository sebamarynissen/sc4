// # version.js
const fs = require('node:fs');
const find = require('pkg-up');
module.exports = JSON.parse(fs.readFileSync(find.sync())).version;
