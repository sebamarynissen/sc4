// # track-command.js
import path from 'node:path';
import { DependencyTracker } from 'sc4/plugins';
import logger from '#cli/logger.js';

type PluginsTrackCommandOptions = {
	directory?: string;
	dependencies?: string[];
	tree?: boolean;
};

// # pluginsTrack()
// The command we use for tracking down all dependencies for a set of files.
export async function pluginsTrack(
	patterns: string[],
	options: PluginsTrackCommandOptions = {},
) {

	// For the directory option, it should be possible to specify it as "." as 
	// well, in which case it would get resolved against the current working 
	// directory!
	let {
		directory = process.env.SC4_PLUGINS ?? process.cwd(),
		dependencies = [],
	} = options;
	directory = path.resolve(process.cwd(), directory);

	// Create the dependency tracker and perform our magic.
	let tracker = new DependencyTracker({
		plugins: directory,
		logger,
	});
	let result = await tracker.track(patterns, {
		dependencies,
	});
	result.dump({ format: options.tree ? 'tree' : 'sc4pac' });

}
