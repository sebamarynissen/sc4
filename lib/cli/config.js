// # config.js
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import Conf from 'conf';
import { parse, Document } from 'yaml';

// # serialize(config)
// This function is responsible for serializing the config file. Note that 
// instead of just serializing the yaml, we will make sure that some values are 
// stored as hex values, as that's more in line with the values people are used 
// to.
function serialize(config) {
	let doc = new Document(config);
	let menus = doc.get('menus', true);
	if (menus) {
		for (let obj of menus.items) {
			(obj.get('id', true) ?? {}).format = 'HEX';
			(obj.get('parent', true) ?? {}).format = 'HEX';
		}
	}
	return doc.toString();
}

const config = new Conf({
	projectName: 'sc4',
	fileExtension: 'yaml',
	deserialize: parse,
	serialize,
});
export default config;

// Verify that a plugins folder has been set.
if (!config.get('folders.plugins')) {
	let plugins = path.resolve(os.homedir(), 'Documents/SimCity 4/Plugins');
	if (fs.existsSync(plugins)) {
		config.set('folders.plugins', plugins);
	}
}
