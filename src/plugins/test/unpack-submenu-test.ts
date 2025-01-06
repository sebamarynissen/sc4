// # unpack-submenu-test.ts
import { resource, output } from '#test/files.js';
import unpackSubmenu from '../unpack-submenu.js';

describe('#unpackSubmenu()', function() {

	it.only('unpacks a submenu button', async function() {

		let file = resource('airport-atc-submenu.dat');
		let dist = output('airport-atc-submenu');
		await unpackSubmenu({
			file,
			output: dist,
		});

	});

});
