import { resource } from '#test/files.js';
import { expect } from 'chai';
import FileType from '../file-types.js';
import Savegame from '../savegame.js';
import Pointer from '../pointer.js';

// # csc4-3drender-test.ts
describe('#cSC43DRender', function() {

	it('is parsed correctly', function() {

		let dbpf = new Savegame(resource('terrain-hole-before.sc4'));
		let entry = dbpf.find({ type: FileType.cSC43DRender })!;
		let renderInfo = entry.read();
		expect(renderInfo.size).to.eql([1920, 1080]);
		expect(renderInfo.resolution).to.eql([1920, 1080]);
		expect(renderInfo.camera).to.be.an.instanceof(Pointer);

	});

});
