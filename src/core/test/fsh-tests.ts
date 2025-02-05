// # fsh-test.ts
import DBPF from '../dbpf.js';
import { resource } from '#test/files.js';
import FileType from '../file-types.js';

describe('The FSH file type', function() {

	it('decompresses all mipmaps in an FSH', async function() {

		this.timeout(10_000);
		let dbpf = new DBPF(resource('DiegoDL-432ParkAvenue-LM-DN/DiegoDL-432ParkAvenue-LM-DN.SC4Model'));
		let entries = dbpf.findAll({ type: FileType.FSH });
		for (let entry of entries) {
			let fsh = entry.read();
			for (let fshEntry of fsh) {
				fshEntry.image.decompress();
			}
		}

	});

});
