// # create-submenu-patch-test.ts
import { resource } from '#test/files.js';
import { expect } from 'chai';
import { FileType } from 'sc4/core';
import { createSubmenuPatch } from 'sc4/plugins';

describe('#createSubmenuPatch()', function() {

	it('creates an exemplar patch dbpf', async function() {

		let directory = resource('submenu-patch-test');
		let dbpf = await createSubmenuPatch({
			files: ['**/*'],
			directory,
			menu: 0x12345678,
		});
		expect(dbpf!.length).to.equal(1);
		let cohort = dbpf!.find({ type: FileType.Cohort, group: 0xb03697d1 })!.read();
		let menu = cohort.get('BuildingSubmenus');
		expect(menu).to.eql([0x12345678]);
		let targets = cohort.get('ExemplarPatchTargets');
		expect(targets).to.eql([
			0x27d79b48, 0x69420ae3,
			0x27d79b48, 0xc9448e91,
		]);

	});

});
