// # unpack-submenu-test.ts
import fs from 'node:fs';
import path from 'node:path';
import { resource, output } from '#test/files.js';
import unpackSubmenu from '../unpack-submenu.js';

describe('#unpackSubmenu()', function() {

	it.only('unpacks a submenu button', async function() {

		let directory = resource('unpack_submenu_test');
		let dist = output('unpack_submenu_test');
		await fs.promises.rm(dist, { recursive: true, force: true });

		let menu = path.join(dist, '0x00000000-airport')
		await fs.promises.mkdir(menu, { recursive: true });
		await fs.promises.writeFile(path.join(menu, '_menu.yaml'), 'id: 0xe99234b3');

		await unpackSubmenu({
			directory,
			output: dist,
		});

	});

});
