// # dbpf-add-command-test.ts
import fs from 'node:fs';
import path from 'node:path';
import { output, resource } from '#test/files.js';
import { DBPF, Exemplar, ExemplarProperty, FileType } from 'sc4/core';
import { randomId } from 'sc4/utils';
import { dbpfAdd } from '../commands/dbpf-add-command.js';
import { compareUint8Arrays } from 'uint8array-extras';
import { expect } from 'chai';
import { stringify } from 'yaml';

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
			logger: null,
		});

		let result = new DBPF(path.join(dist, 'dist/dbpf.SC4Lot'));
		let entry = result.find([0x6534284A, 0xA8FBD372, 0x483248BB]);
		expect(entry).to.be.ok;
		expect(compareUint8Arrays(entry!.decompress(), exemplar.toBuffer())).to.equal(0);

	});

	it('adds an entire DBPF file to a DBPF', async function() {

		const source = new DBPF(resource('cement.sc4lot'));
		const cwd = output('dbpf_add_dbpf_test');
		await fs.promises.rm(cwd, { recursive: true, force: true });
		await fs.promises.mkdir(cwd, { recursive: true });

		await dbpfAdd(source.file!, {
			output: 'dist/packed.dat',
			directory: cwd,
			logger: null,
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

	it('adds a .txt as LTEXT', async function() {

		const cwd = output('dbpf_add_txt');
		const write = this.createWriter(cwd);
		await fs.promises.rm(cwd, { recursive: true, force: true });

		await write('description.txt', 'Hello, this is a description');
		await write('description.txt.TGI', `0x2026960B\n0xA8FBD372\n483248BB`);

		await dbpfAdd('*.txt', {
			output: 'dist/dbpf.SC4Desc',
			directory: cwd,
			logger: null,
		});

		let result = new DBPF(path.join(cwd, 'dist/dbpf.SC4Desc'));
		let entry = result.find({ type: FileType.LTEXT })!;
		let ltext = entry.read();
		expect(ltext.value).to.equal('Hello, this is a description');

	});

	it('automatically converts yaml exemplars', async function() {

		const cwd = output('dbpf_add_yaml');
		const write = this.createWriter(cwd);
		await fs.promises.rm(cwd, { recursive: true, force: true });

		await write('exemplar.yaml', stringify({
			parent: [FileType.Cohort, 0x1ae45fee, 0x4a879d5f],
			properties: [
				{
					id: 0x10,
					value: 0x21,
					type: 'Uint32',
				},
				{
					id: 0x27812821,
					value: [FileType.S3D, 0x1ae45fee, 0x4a879d5f],
					type: 'Uint32',
				},
			],
		}));
		await write('exemplar.yaml.TGI', `6534284A\nA8FBD372\n483248BB`);

		await dbpfAdd('*.yaml', {
			output: 'dist/dbpf.SC4Desc',
			directory: cwd,
			logger: null,
		});

		let result = new DBPF(path.join(cwd, 'dist/dbpf.SC4Desc'));
		let entry = result.find({ type: FileType.Exemplar })!;
		let exemplar = entry.read();
		expect(exemplar.get('ExemplarType')).to.equal(0x21);
		expect(exemplar.get('ResourceKeyType1')).to.eql([FileType.S3D, 0x1ae45fee, 0x4a879d5f]);

	});

	it('specifies what files need to be compressed', async function() {

		const cwd = output('dbpf_add_compress');
		const write = this.createWriter(cwd);
		await fs.promises.rm(cwd, { recursive: true, force: true });

		await write('icon.png', new Uint8Array([0, 1]));
		await write('icon.png.TGI', `856DDBAC\nA8FBD372\n483248BB`);

		await write('exemplar.eqz', new Uint8Array(100));
		await write('exemplar.eqz.TGI', `6534284A\nA8FBD372\n483248BB`);

		await dbpfAdd('*', {
			output: 'output.dat',
			directory: cwd,
			logger: null,
			compress: '*.eqz',
		});
		let result = new DBPF(path.join(cwd, 'output.dat'));
		let icon = result.find({ type: FileType.PNG })!;
		expect(icon.compressed).to.be.false;
		let exemplar = result.find({ type: FileType.Exemplar })!;
		expect(exemplar.compressed).to.be.true;

	});

	it('throws an error if the output file exists', async function() {

		const cwd = output('dbpf_add_exists');
		const write = this.createWriter(cwd);
		await fs.promises.rm(cwd, { recursive: true, force: true });

		await write('dist/output.dat', new Uint8Array());
		await write('icon.png', new Uint8Array([0, 1]));
		await write('icon.png.TGI', `856DDBAC\nA8FBD372\n483248BB`);

		try {
			await dbpfAdd('*.png', {
				output: 'dist/output.dat',
				directory: cwd,
				logger: null,
			});
		} catch (e) {
			expect(e.code).to.equal('EEXIST');
			return;
		}

		// We shouldn't reach this point.
		throw new Error();

	});

	it('overrides output files with the -f flag', async function() {

		const cwd = output('dbpf_add_exists');
		const write = this.createWriter(cwd);
		await fs.promises.rm(cwd, { recursive: true, force: true });

		await write('dist/output.dat', new Uint8Array());
		await write('icon.png', new Uint8Array([0, 1]));
		await write('icon.png.TGI', `6534284A\nA8FBD372\n483248BB`);
		await dbpfAdd('*.png', {
			output: 'dist/output.dat',
			directory: cwd,
			logger: null,
			force: true,
		});

	});

});
