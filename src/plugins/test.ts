import { Glob } from 'glob';
import fs from 'node:fs';
import { parentPort, isMainThread, Worker } from 'node:worker_threads';
import Stream from '../../lib/core/stream.js';
import Entry from '../../lib/core/dbpf-entry.js';
import { TGIIndex } from 'sc4/utils';
import { Index } from './hash-map.ts';
import { FileType } from 'sc4/core';

function hash32to16(x) {
    return ((x * 2654435761) >>> 16) & 0xFFFF;
}

function hashUint8Array3(arr) {
    return (
        (arr[0]  | (arr[1]  << 8) | (arr[2]  << 16) | (arr[3]  << 24)) ^
        (arr[4]  | (arr[5]  << 8) | (arr[6]  << 16) | (arr[7]  << 24)) ^
        (arr[8]  | (arr[9]  << 8) | (arr[10] << 16) | (arr[11] << 24))
    ) >>> 0;
}

function hashUint8Array2(arr) {
    return (
        (arr[0] | (arr[1] << 8) | (arr[2] << 16) | (arr[3] << 24)) ^
        (arr[4] | (arr[5] << 8) | (arr[6] << 16) | (arr[7] << 24))
    ) >>> 0;
}

const hh = (arr) =>
	BigInt(arr[1]) << 32n |
	BigInt(arr[2]);

const hhh = (t, i, g) =>
	BigInt(t) << 64n |
	BigInt(i) << 32n |
	BigInt(g);

if (isMainThread) {

	// Prepare our worker.
	const worker = new Worker(new URL(import.meta.url));

	const LE = true;

	performance.mark('glob:start');
	const glob = new Glob('**/*.{dat,sc4lot,sc4desc,sc4model}', {
		cwd: process.env.SC4_PLUGINS,
		absolute: true,
		nodir: true,
		nocase: true,
		follow: true,
	});
	const files = await glob.walk();
	files.length = 1;
	performance.mark('glob:end');
	performance.mark('sort:start');
	files.sort();
	performance.mark('sort:end');

	performance.mark('parse:start');
	const entries = new TGIIndex<Entry>();
	const tasks = files.map(async file => {
		let handle = await fs.promises.open(file);
		let bytes = new Uint8Array(96);
		await handle.read(bytes, 0, 96);
		let view = new DataView(bytes.buffer);
		let count = view.getUint32(36, LE);
		let offset = view.getUint32(40, LE);
		let size = view.getUint32(44, LE);

		// Read in the index. now.
		let index = new Uint8Array(size);
		await handle.read(index, 0, size, offset);
		let rs = new Stream(index);
		for (let i = 0; i < count; i++) {
			let tgi = rs.tgi();
			let offset = rs.uint32();
			let size = rs.uint32();
			let entry = new Entry({ tgi, offset, size });
			entries.push(entry);
		}
		let promise = handle.close();

		await promise;
	});
	await Promise.all(tasks);
	performance.mark('parse:end');

	performance.mark('zip:start');
	let arr = new Uint32Array(3*entries.length);
	let offset = 0;
	for (let entry of entries) {
		let { tgi } = entry;
		arr[offset++] = tgi.type;
		arr[offset++] = tgi.group;
		arr[offset++] = tgi.instance;
	}
	performance.mark('zip:end');

	performance.mark('index:start');
	let index = new Index(arr);
	performance.mark('index:end');

	performance.mark('lookup:start');
	let query = index.findType(FileType.Exemplar);
	console.log('Exemplars found:', query.length);
	let ptrs = index.findTGI(0x05342861,0xb03697d1,0xed619069);
	console.log(entries[ptrs[0]]);
	performance.mark('lookup:end');

	// Fire up the work and send the uint32 array to it.
	performance.mark('worker:start');
	const { promise, resolve } = Promise.withResolvers();
	worker.postMessage(arr, [arr.buffer]);
	worker.on('message', () => resolve(null));
	await promise;
	performance.mark('worker:end');


	performance.measure('Glob', 'glob:start', 'glob:end');
	performance.measure('Sort', 'sort:start', 'sort:end');
	performance.measure('Parse', 'parse:start', 'parse:end');
	performance.measure('Convert entries to Uint32Array', 'zip:start', 'zip:end');
	performance.measure('Main thread index', 'index:start', 'index:end');
	performance.measure('Queries', 'lookup:start', 'lookup:end');
	performance.measure('Worker', 'worker:start', 'worker:end');

	let table = performance.getEntriesByType('measure')
		.map(measure => Object({
			name: measure.name,
			duration: measure.duration,
		}));
	console.table(table);
	console.log('length', entries.length);

	worker.terminate();

} else if (parentPort) {

	parentPort.on('message', arr => {
		// let map = generateMap(arr);
		// let clone = new Uint32Array(arr);
		// console.log(map);
		parentPort.postMessage('foo');
		// parentPort!.postMessage(map, [map.buffer]);
		// let index = new Index(arr);
		// console.timeEnd('index');
		// let { tgi, ti, i, t } = index;
		// parentPort.postMessage({ tgi, ti, i, t });
	});

}
