// # plugins-track-flow.ts
import * as prompts from '#cli/prompts';
import { DependencyTracker } from 'sc4/plugins';
import logger from '#cli/logger.js';

export async function pluginsTrack() {
	let plugins = process.env.SC4_PLUGINS;
	let files = await prompts.file({
		type: 'file+directory',
		basePath: plugins,
		message: 'Select the file or directory you want to track plugins for',
	});
	let tracker = new DependencyTracker({ plugins, logger });
	let result = await tracker.track(files);

	// Filter out common packages like simfox's day and nite mod.
	let exclude = new Set([
		'simfox:day-and-nite-mod',
	]);
	result.packages = result.packages.filter(pkg => !exclude.has(pkg));
	result.dump({ format: 'sc4pac' });
	console.log('\n');

	// Ask whether we should show the dependency tree as well.
	let confirm = await prompts.confirm({
		message: 'Do you want to view the complete dependency tree?',
		default: false,
	});
	if (confirm) {
		result.dump({ format: 'tree' });
		console.log('\n');
	}

}
