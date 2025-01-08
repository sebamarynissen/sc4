// # unpack-submenu-test.ts
import fs from 'node:fs';
import path from 'node:path';
import { resource, output } from '#test/files.js';
import unpackSubmenu from '../unpack-submenu.js';
import { expect } from 'chai';
import { parse } from 'yaml';

describe('#unpackSubmenu()', function() {

	it('unpacks a submenu button', async function() {

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

		const exists = (x: string) => fs.existsSync(path.join(dist, x));
		const read = (x: string) => String(fs.readFileSync(path.join(dist, x)));
		const yaml = (x: string) => parse(read(x));

		expect(exists('orphans')).to.be.false;
		expect(yaml('0x00000000-airport/_0xFFFFFE80-submenu-modular-airport/_menu.yaml')).to.eql({
			id: 0xc1e9138f,
			name: 'Modular Airport Lots',
			description: [ 0x2026960b, 0x123006aa, 0x6e967dff ],
		});
		expect(yaml('0x00000000-airport/_0xFFFFFE80-submenu-modular-airport/_0xFFFFFF01-submenu-atc/_menu.yaml')).to.eql({
			id: 0x803da728,
			name: 'Air traffic control systems',
			description: [ 0x2026960b, 0x123006aa, 0x6e967dff ],
		});
		expect(yaml('0x00000000-airport/_0xFFFFFE80-submenu-modular-airport/_0xFFFFFF01-submenu-atc/_0xFFFFFF02-submenu-atc-towers/_menu.yaml')).to.eql({
			id: 0x414efa54,
			name: 'ATC towers',
			description: [ 0x2026960b, 0x123006aa, 0x6e967dff ],
		});

		let patch = read('0x00000000-airport/_0xFFFFFE80-submenu-modular-airport/_0xFFFFFF01-submenu-atc/_0xFFFFFF02-submenu-atc-towers/Patch ATC Towers.txt');
		expect(patch).to.be.ok;

	});

});
