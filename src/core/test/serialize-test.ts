// # serialize-test.ts
// This file contains some automatic tests that ensure that every file format 
// that we have decoded and which implements a parse/serialize functionality 
// actually works as expected and doesn't accidentally corrupt savegames without 
// modifying anything. We do this by using a few test cities and decode & 
// serialize as much subfiles as possible, and then ensure that everything is 
import { expect } from 'chai';
import Savegame from '../savegame.js';
import classes from '../file-classes.js';
import { kFileType } from '../symbols.js';
import { resource } from '#test/files.js';
import { compareUint8Arrays } from 'uint8array-extras';
import FileType from '../file-types.js';
import { readRecordsAsBuffers } from '../helpers.js';

// still the same. Note that for large cities, this can take some time.
const files = [
	'City - RCI.sc4',
	'City - large developed.sc4',
	'God mode.sc4',
];

describe('Parsing & serializing', function() {

	const run = (dbpf: Savegame) => {
		for (let Constructor of Object.values(classes) as any) {
			let skip = !Constructor.prototype.toBuffer;
			let entries = dbpf.findAll({ type: Constructor[kFileType] })
				.filter(entry => {

					// For now the terrain edge altitudes are not supported, we 
					// have to fix this though, but not for now in these tests.
					if (entry.type === FileType.TerrainMap) {
						return entry.instance === 0x01;
					} else {
						return true;
					}

				});
			for (let entry of entries) {
				it(entry.id, function() {

					// If there's no "toBuffer()" method, then we skip it, but 
					// we'll report it though.
					if (skip) {
						this.test!.title += ` (${Constructor.name} has no .toBuffer())`;
						return this.skip();
					}
					this.timeout(10_000);
					let file = entry.read();
					if (Array.isArray(file) && file[0].toBuffer) {
						let buffer = entry.decompress();
						let buffers = readRecordsAsBuffers(buffer);
						expect(file.length).to.equal(buffers.length);
						for (let i = 0; i < buffers.length; i++) {
							let serialized = file[i].toBuffer();
							let buffer = buffers[i];
							expect(
								compareUint8Arrays(serialized, buffer),
							).to.equal(0);
						}
					} else {
						let buffer = entry.decompress();
						let serialized = file.toBuffer();
						expect(
							compareUint8Arrays(serialized, buffer)
						).to.equal(0);
					}
				});
			}
		}
	};

	const fn = (file: string) => describe(file, function() {
		run(new Savegame(resource(file)));
	});
	for (let file of files) fn(file);

});
