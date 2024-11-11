// # folders.js
import path from 'node:path';
export default {
	get plugins() {
		return getPlugins();
	},
};

// # getPlugins()
// Finds the location of the plugins folder.
function getPlugins() {
	return path.resolve(process.env.HOMEPATH, 'Documents/SimCity 4/Plugins');
}
