// # get-test-file.js
import fs from 'node:fs';
import path from 'node:path';

// Ensure that the output file is properly created when running tests in a clean 
// environment - for example CI on GitHub actions.
const outputDir = path.join(import.meta.dirname, './output');
if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir);
}

// # resource(file)
// Helper function that easily gets the path of a given test file in the test 
// folder.
export function resource(file) {
	return path.resolve(
		import.meta.dirname,
		'./files',
		file,
	);
}

// # output(file)
// Returns the path to the output folder for our tests. This has to be added to 
// .gitignore obviously.
export function output(file) {
	return path.resolve(outputDir, file);
}
