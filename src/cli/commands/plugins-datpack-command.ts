import { Glob } from 'glob';
import { styleText } from 'node:util';
import logger from '#cli/logger.js';
import { FileScanner, folderToPackageId } from 'sc4/plugins';
import { DBPF, DBPFStream } from 'sc4/core';
import path from 'node:path';
import fs from 'node:fs';

// # plugins-datpack-command.ts
type DatPackCommandOptions = {
	directory?: string;
};

export async function pluginsDatpack(opts: DatPackCommandOptions) {
	const { directory = process.env.SC4_PLUGINS } = opts;
	const glob = new Glob('[0-9][0-9][0,2,4,6,8]-*/*.sc4pac/', {
		cwd: directory,
		absolute: true,
	});
	const folders = await glob.walk();
	logger.progress.start('Scanning plugins');
	for (let folder of folders) {
		let glob = new FileScanner('**/*', { cwd: folder });
		let files = await glob.walk();
		files.sort();
		if (files.length > 10) {
			let basename = path.basename(folder);
			let output = path.join(folder, `${basename}.dat`);
			let id = styleText('green', folderToPackageId(folder)!);
			let stream = new DBPFStream(output, 'w');
			for (let file of files) {
				logger.progress.update(`Processing ${id}/${path.basename(file)}`)
				let dbpf = new DBPF({ file, parse: false });
				await dbpf.parseAsync();
				await stream.addDbpf(dbpf);
			}
			await stream.seal();

			// Remove all files, and then all folders as well - which should be empty now.
			for (let file of files) {
				await fs.promises.rm(file);
			}
			const glob = new Glob('*/', {
				cwd: folder,
				absolute: true,
			});
			for await (let folder of glob) {
				await fs.promises.rm(folder, { recursive: true, force: true });
			}

		}
	}
	logger.progress.succeed();
}
