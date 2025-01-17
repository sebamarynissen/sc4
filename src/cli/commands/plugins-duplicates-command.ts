// # plugins-duplicates-command.ts
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import PQueue from 'p-queue';
import { FileScanner } from 'sc4/plugins';
import logger from '#cli/logger.js';
import { styleText } from 'node:util';

type FileInfo = {
	hash: string;
	basename: string;
	path: string;
};

export async function pluginsDuplicates(opts: { directory: string }) {
	const {
		directory = process.env.SC4_PLUGINS!,
	} = opts;
	const cwd = path.resolve(process.cwd(), directory);
	const glob = new FileScanner('**/*', { cwd });
	let info: FileInfo[] = [];
	const map: Record<string, number> = {};
	const queue = new PQueue({ concurrency: 250 });
	logger.progress.start('Scanning plugins');
	for await (let file of glob) {
		queue.add(async () => {
			let contents = await fs.promises.readFile(file);
			let hash = createHash('sha256')
				.update(contents)
				.digest('hex');
			let basename = path.basename(file);
			info.push({
				hash,
				basename,
				path: path.relative(cwd, file),
			});
			map[hash] ??= 0;
			map[hash]++;
		});
	}
	await queue.onIdle();
	logger.progress.succeed();

	// Fiter out anything that has a unique hash.
	info = info.filter(info => map[info.hash]! > 1);
	info.sort((a, b) => a.path < b.path ? -1 : 1);

	// Cool, everything has been scanned. Let's group based on filename, and the 
	// subgroup by hash.
	let table: any = [];
	let grouped = Object.groupBy(info, info => info.hash);
	for (let hash of Object.keys(grouped)) {
		let group = grouped[hash]!;
		for (let i = 0; i < group.length; i++) {
			let info = group[i];
			table.push({
				...i === 0 ? {
					hash: {
						[Symbol.for('nodejs.util.inspect.custom')]() {
							return styleText('yellow', hash.slice(0, 9));
						},
					},
				} : null,
				file: {
					[Symbol.for('nodejs.util.inspect.custom')]() {
						return styleText('cyan', info.path);
					},
				},
			});
		}
		table.push({});
	}
	console.table(table, ['hash', 'file']);

}
