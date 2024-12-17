// # region-view-test.ts
import { expect } from 'chai';
import { resource } from '#test/files.js';
import { FileType, Savegame } from 'sc4/core';

describe('The RegionView subfile', function() {

	it.only('is partially decoded', function() {

		let dbpf = new Savegame(resource('City - Large developed.sc4'));
		let entry = dbpf.find({ type: FileType.RegionView })!;
		let view = entry.read();
		console.log(view);

	});

});
