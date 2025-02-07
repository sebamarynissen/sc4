// # fsh-test.ts
import fs from 'node:fs/promises';
import DBPF from '../dbpf.js';
import { resource } from '#test/files.js';
import FileType from '../file-types.js';
import { expect } from 'chai';
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
			expect(fsh.image).to.equal(fsh.entries[0].mipmaps[0]);
		}

	});

	it('decompresses a grayscale 8-bit FSH', async function() {

		let file = resource('fsh/0x7b.fsh');
		let buffer = await fs.readFile(file);
		let fsh = new FSH().parse(buffer);
		let data = fsh.entries[0].image.decompress();
		for (let i = 0; i < data.length; i += 4) {
			expect(data[i]).to.equal(data[i+1]);
			expect(data[i]).to.equal(data[i+2]);
			expect(data[i+3]).to.equal(0xff);
		}

	});

	it('decompresses a 32-bit A8R8G8B8 bitmap', async function() {

		let file = resource('fsh/0x7d.fsh');
		let buffer = await fs.readFile(file);
		let fsh = new FSH().parse(buffer);
		let bitmap = fsh.entries[0].image.decompress();
		expect(bitmap).to.eql(new Uint8Array([
			0, 0, 0xff, 0,
			0, 0, 0xff, 0,
			0, 0, 0xff, 0,
			0, 0, 0xff, 0,
		]));

	});

	it('decompresses a 24-bit R8G8B8 bitmap', async function() {

		let file = resource('fsh/0x7f.fsh');
		let buffer = await fs.readFile(file);
		let fsh = new FSH().parse(buffer);
		let bitmap = fsh.entries[0].image.decompress();
		expect(bitmap).to.eql(new Uint8Array([
			0, 0, 0, 0xff,
			0, 0, 0, 0xff,
			0, 0, 0, 0xff,
			0, 0, 0, 0xff,
		]));

	});

});
