// # config.js
import Conf from 'conf';
import { parse, stringify } from 'yaml';
import path from 'node:path';
import fs from 'node:fs';

const config = new Conf({
	projectName: 'sc4',
	fileExtension: 'yaml',
	deserialize: parse,
	serialize: stringify,
});
export default config;

// Verify that a plugins folder has been set.
if (!config.get('folders.plugins')) {
	let plugins = path.resolve(process.env.HOMEPATH, 'Documents/SimCity 4/Plugins');
	if (fs.existsSync(plugins)) {
		config.set('folders.plugins', plugins);
	}
}