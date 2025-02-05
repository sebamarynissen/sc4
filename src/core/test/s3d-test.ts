// # s3d-test.ts
import { expect } from 'chai';
import { compareUint8Arrays, indexOf } from 'uint8array-extras';
import DBPF from '../dbpf.js';
import { resource } from '#test/files.js';

const ids = ['3DMD', 'VERT', 'INDX', 'PRIM', 'MATS', 'ANIM', 'PROP', 'REGP'];
describe('The S3D file type', function() {

	// Helper function that nullifies the values after the various header 
	// identifiers. That's because apparently the sizes don't always match, and 
	// that's no problem.
	function nullify(buffer: Uint8Array, headers: string[] = ids) {
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
		let entries = dbpf.findAll({ type: 0x5ad0e817 });
		for (let entry of entries) {
			let model = entry.read();
			let source = nullify(entry.decompress());
			let buffer = nullify(model.toBuffer());
			expect(compareUint8Arrays(source, buffer)).to.equal(0);
		}

	});

});
