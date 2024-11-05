// # get-test-file.js
const path = require('node:path');

// # getTestFile(file)
// Helper function that easily gets the path of a given test file in the test 
// folder.
module.exports = function getTestFile(file) {
	return path.resolve(
		__dirname,
		'./files',
		file,
	);
};
