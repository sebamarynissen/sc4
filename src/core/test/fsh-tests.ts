// # fsh-test.ts
import fs from 'node:fs/promises';
import DBPF from '../dbpf.js';
import { resource } from '#test/files.js';
import FileType from '../file-types.js';
import { expect } from 'chai';
import { PluginIndex } from 'sc4/plugins';
import Stream from '../stream.js';
import FSH from '../fsh.js';

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

	it.only('decompresses a grayscale 8-bit FSH', async function() {

		let file = resource('fsh/0x7b.fsh');
		let buffer = await fs.readFile(file);
		let fsh = new FSH().parse(new Stream(buffer));
		let data = fsh.entries[0].image.decompress();
		for (let i = 0; i < data.length; i += 4) {
			expect(data[i]).to.equal(data[i+1]);
			expect(data[i]).to.equal(data[i+2]);
			expect(data[i+3]).to.equal(0xff);
		}

	});

	it.skip('looks for FSHs', async function() {
		this.timeout(0);

		let index = new PluginIndex({
			plugins: undefined,
		});
		await index.build();
		let textures = index.findAll({ type: FileType.FSH });
		for (let entry of textures) {
			try {
				let fsh = entry.read();
				for (let fshEntry of fsh) {
					for (let mipmap of fshEntry) {
						// mipmap.decompress();
					}
				}
			} catch (e) {

				let buffer = entry.decompress();
				await fs.writeFile('0x7b.fsh', buffer);
				console.log(buffer);
				console.log(entry.id);
				console.log(entry.dbpf.file);
				throw e;
			}
		}

	});

});
