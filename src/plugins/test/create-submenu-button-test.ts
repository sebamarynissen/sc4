// # create-submenu-button-test.js
import { expect } from 'chai';
import fs from 'node:fs';
import { resource } from '#test/files.js';
import { DBPF, FileType } from 'sc4/core';
import createSubmenuButton from '../create-submenu-button.js';
import { compareUint8Arrays } from 'uint8array-extras';

describe('#createSubmenuButton()', function() {

	it('uses a png from the filesystem', async function() {

		let icon = resource('menu-icon.png');
		let { dbpf, button } = await createSubmenuButton({
			name: 'Stadiums',
			parent: 0xabcd1234,
			description: 'Open the submenu containing all stadiums',
			icon,
		});

		let clone = new DBPF(dbpf.toBuffer());
		let exemplar = clone.find({ type: FileType.Exemplar, instance: button.id })!.read();
		expect(exemplar.value(0x10)).to.equal(0x28);
		expect(exemplar.value(0x20)).to.equal('submenu-stadiums');
		expect(exemplar.value(0x8A2602B8)).to.equal(button.id);
		expect(exemplar.value(0x8A2602BB)).to.equal(button.id);
		expect(exemplar.value(0x8A2602CA)).to.equal(0xabcd1234);
		expect(exemplar.value(0x8A2602CC)).to.equal(0x01);

		// Test the ltext references.
		expect(exemplar.value(0x8A416A99)).to.eql([
			FileType.LTEXT, 0x123007bb, button.id,
		]);
		expect(exemplar.value(0xCA416AB5)).to.eql([
			FileType.LTEXT, 0x123006aa, button.id,
		]);

		let name = clone.find({ type: FileType.LTEXT, group: 0x123007bb, instance: button.id })!.read();
		expect(name.value).to.equal('Stadiums');

		let description = clone.find({ type: FileType.LTEXT, group: 0x123006aa, instance: button.id })!.read();
		expect(description.value).to.equal('Open the submenu containing all stadiums');

		let png = clone.find({ type: FileType.PNG })!.read();
		expect(compareUint8Arrays(png, fs.readFileSync(icon))).to.equal(0);

	});

	it('uses a png from a buffer', async function() {

		let buffer = fs.readFileSync(resource('menu-icon.png'));
		let { dbpf } = await createSubmenuButton({
			name: 'Stadiums',
			parent: 0xabcd1234,
			description: 'Open the submenu containing all stadiums',
			icon: buffer,
		});

		let clone = new DBPF(dbpf.toBuffer());
		let png = clone.find({ type: FileType.PNG })!.read();
		expect(compareUint8Arrays(png, buffer)).to.equal(0);

	});

});
