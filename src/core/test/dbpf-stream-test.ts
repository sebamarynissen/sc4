// # dbpf-stream-test.ts
import { output } from '#test/files.js';
import { expect } from 'chai';
import DBPFStream from '../dbpf-stream.js';
import DBPF from '../dbpf.js';
import FileType from '../file-types.js';
import TGI from '../tgi.js';
import { compareUint8Arrays } from 'uint8array-extras';
import { compress } from 'qfs-compression';

describe('A DBPF stream', function() {

	it('creates a DBPF in a streamified way', async function() {

		let file = output('dbpf-stream.dbpf');
		let stream = new DBPFStream(file);

		let tgi = TGI.random(FileType.Exemplar);
		let buffer = crypto.getRandomValues(new Uint8Array(100));
		await stream.add(tgi, buffer);
		await stream.seal();

		let dbpf = new DBPF(file);
		let entry = dbpf.find(tgi)!;
		expect(entry).to.be.ok;
		expect(entry.size).to.equal(100);
		expect(compareUint8Arrays(entry.readRaw(), buffer)).to.equal(0);

	});

	it('compresses DBPF files in a streamified way', async function() {

		let file = output('dbpf-stream.dbpf');
		let stream = new DBPFStream(file);

		let tgi = TGI.random(FileType.Exemplar);
		let buffer = new Uint8Array(100);
		await stream.add(tgi, buffer, { compress: true });
		await stream.seal();

		let dbpf = new DBPF(file);
		let entry = dbpf.find(tgi)!;
		expect(entry).to.be.ok;
		expect(entry.size).to.be.below(buffer.byteLength);
		expect(entry.size).to.equal(compress(buffer, { includeSize: true }).byteLength);
		expect(compareUint8Arrays(entry.readRaw(), buffer)).to.not.equal(0);
		expect(compareUint8Arrays(entry.decompress(), buffer)).to.equal(0);

	});

	it('knows entries are already compressed', async function() {

		let file = output('dbpf-stream.dbpf');
		let stream = new DBPFStream(file);

		let tgi = TGI.random();
		let buffer = crypto.getRandomValues(new Uint8Array(100));
		await stream.add(tgi, buffer);
		await stream.seal();

		let dbpf = new DBPF(file);
		let entry = dbpf.find(tgi)!;
		expect(entry).to.be.ok;
		expect(entry.size).to.equal(100);
		expect(compareUint8Arrays(entry.readRaw(), buffer)).to.equal(0);

	});

});
