// # s3d-test.ts
import { expect } from 'chai';
import { compareUint8Arrays, indexOf } from 'uint8array-extras';
import DBPF from '../dbpf.js';
import { resource } from '#test/files.js';

describe('The S3D file type', function() {

	// Helper function that nullifies the values after the various header 
	// identifiers. That's because apparently the sizes don't always match.
	function nullify(buffer: Uint8Array, headers: string[] = ['3DMD', 'ANIM']) {
		for (let header of headers) {
			let bytes = new TextEncoder().encode(header);
			let index = indexOf(buffer, bytes);
			if (index > -1) {
				buffer.set([0, 0, 0, 0], index+bytes.length);
			}
		}
		return buffer;
	}

	it('parses & serializes S3D file', function() {

		let dbpf = new DBPF(resource('DiegoDL-432ParkAvenue-LM-DN/DiegoDL-432ParkAvenue-LM-DN.SC4Model'));
		let entry = dbpf.find(0x5ad0e817, 0x4828fc06, 0x00030400)!;
		let model = entry.read();
		let source = nullify(entry.decompress());
		let buffer = nullify(model.toBuffer());
		expect(compareUint8Arrays(source, buffer)).to.equal(0);

	});

});
