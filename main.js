import { growify } from 'sc4/api';
import { Savegame } from 'sc4';
import { Buffer } from 'buffer';

let input = document.querySelector('input[type="file"]');
input.addEventListener('input', async event => {
	let [file] = event.target.files;
	let buffer = Buffer.from(await read(file));
	let dbpf = new Savegame(buffer);
	await growify({
		dbpf,
	});
	let out = dbpf.toBuffer();
	console.log(out);
});

function read(file) {
	return new Promise(resolve => {
		let reader = new FileReader();
		reader.addEventListener('load', () => resolve(reader.result));
		reader.readAsArrayBuffer(file);
	});
}
