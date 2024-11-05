// # get-test-file.js
import path from 'node:path';

// # getTestFile(file)
// Helper function that easily gets the path of a given test file in the test 
// folder.
export default function getTestFile(file) {
	return path.resolve(
		import.meta.dirname,
		'./files',
		file,
	);
}
