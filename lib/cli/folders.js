// # folders.js
import path from 'node:path';
import fs from 'node:fs';
import config from './config.js';
export default {
	get plugins() {
		return getPlugins();
	},
};

// # getPlugins()
// Finds the location of the plugins folder.
function getPlugins() {
	const fromConfig = config.get('folders.plugins');
	if (fromConfig) return fromConfig;
	let plugins = path.resolve(process.env.HOMEPATH, 'Documents/SimCity 4/Plugins');
	if (!fs.existsSync(plugins)) {
		return process.cwd();
	}
	return plugins;
}

console.log(getPlugins());
