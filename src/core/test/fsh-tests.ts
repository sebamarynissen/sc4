// # fsh-test.ts
import DBPF from '../dbpf.js';
import { resource } from '#test/files.js';
import FileType from '../file-types.js';
import { expect } from 'chai';

describe('The FSH file type', function() {

	it('decompresses all mipmaps in an FSH', async function() {

		this.timeout(10_000);
		let dbpf = new DBPF(resource('DiegoDL-432ParkAvenue-LM-DN/DiegoDL-432ParkAvenue-LM-DN.SC4Model'));
		let entries = dbpf.findAll({ type: FileType.FSH });
		for (let entry of entries) {
			let fsh = entry.read();
			for (let fshEntry of fsh) {
				for (let mipmap of fshEntry) {
					let { width, height } = mipmap;
					let buffer = mipmap.decompress();
					expect(buffer).to.have.length(width*height*4);
				}
			}
		}

	});

});
