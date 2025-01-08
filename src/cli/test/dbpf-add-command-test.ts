// # dbpf-add-command-test.ts
import fs from 'node:fs';
import path from 'node:path';
import { output, resource } from '#test/files.js';
import { DBPF, Exemplar, ExemplarProperty, FileType } from 'sc4/core';
import { randomId } from 'sc4/utils';
import { dbpfAdd } from '../commands/dbpf-add-command.js';
import { compareUint8Arrays } from 'uint8array-extras';
import { expect } from 'chai';

describe('The dbpfAdd() command', function() {

	before(function() {
		this.createWriter = function(folder: string) {
			return async function write(basename: string, contents: string | Uint8Array) {
				let file = path.join(folder, basename);
				await fs.promises.mkdir(path.dirname(file), { recursive: true });
				await fs.promises.writeFile(file, contents);
			};
		};
	});

	it('adds multiple files to a DBPF', async function() {

		const dist = output('dbpf_add_file_test');
		const write = this.createWriter(dist);
		await fs.promises.rm(dist, { recursive: true, force: true });

		let exemplar = new Exemplar({
			parent: [FileType.Cohort, randomId(), randomId()],
			properties: [
				{
					id: +ExemplarProperty.ExemplarType,
					value: 0x10,
				},
			],
		});

		await write('exemplar.eqz', exemplar.toBuffer());
		await write('exemplar.eqz.TGI', `6534284A\nA8FBD372\n483248BB`);

		await dbpfAdd('*', {
			output: 'dist/dbpf.SC4Lot',
			directory: dist,
		});

		let result = new DBPF(path.join(dist, 'dist/dbpf.SC4Lot'));
		let entry = result.find([0x6534284A, 0xA8FBD372, 0x483248BB]);
		expect(entry).to.be.ok;
		expect(compareUint8Arrays(entry!.decompress(), exemplar.toBuffer())).to.equal(0);

	});

	it('adds an entire DBPF file to a DBPF', async function() {

		const source = new DBPF(resource('cement.sc4lot'));
		const cwd = output('dbpf_add_dbpf_test');

		await dbpfAdd(source.file!, {
			output: 'dist/packed.dat',
			directory: cwd,
		});

		let result = new DBPF(path.join(cwd, 'dist/packed.dat'));
		for (let entry of source) {
			if (entry.type === FileType.DIR) continue;
			let sibling = result.find(entry.tgi)!;
			expect(sibling).to.be.ok;
			expect(sibling.compressed).to.equal(entry.compressed);
			expect(sibling.fileSize).to.equal(entry.fileSize);
			expect(sibling.compressedSize).to.equal(entry.compressedSize);
			expect(compareUint8Arrays(
				sibling.readRaw(),
				entry.readRaw(),
			)).to.equal(0);
		}

	});

	it('adds a .txt as LTEXT');

});
