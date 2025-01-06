// # unpack-submenu-test.ts
import { resource, output } from '#test/files.js';
import unpackSubmenu from '../unpack-submenu.js';

describe('#unpackSubmenu()', function() {

	it.only('unpacks a submenu button', async function() {

		let directory = resource('unpack_submenu_test');
		let dist = output('unpack_submenu_test');
		await unpackSubmenu({
			directory,
			output: dist,
		});

	});

});
