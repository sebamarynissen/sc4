// # file.js
const path = require('node:path');
const dir = path.resolve(__dirname, '../test/files');

module.exports = function getFile(bare) {
	return path.resolve(dir, bare);
};
