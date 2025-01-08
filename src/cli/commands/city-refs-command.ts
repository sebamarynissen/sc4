// # city-refs-command.ts
import logger from '#cli/logger.js';
import path from 'node:path';
import { Savegame } from 'sc4/core';
import { findPatternOffsets } from 'sc4/utils';

type CityRefsCommandOptions = {
	address?: number | string;
	type?: number | string;
};

export function cityRefs(city: string, opts: CityRefsCommandOptions) {
	let file = path.resolve(process.cwd(), city);
	let dbpf = new Savegame(file);

	// Transform the adddress or type we have to look for into a Uint8Array that 
	// we'll subsequently look for in the raw buffers.
	let integer = +opts.address! || +opts.type!;
	if (!integer) {
		logger.error('Please specify a non-zero address or type!');
		return;
	}
	let pattern = new Uint8Array(4);
	let view = new DataView(pattern.buffer);
	view.setUint32(0, integer, true);

	// Loop all records and the find for the patterns in that buffer.
	let ctx = dbpf.createContext();
	let refs = ctx.getRecordList();
	let list = [];
	for (let row of refs) {
		let { entry } = row;
		let buffer = entry.decompress();
		let offsets = findPatternOffsets(buffer, pattern);
		if (offsets.length > 0) {
			list.push({
				class: row.label,
				count: offsets.length,
			});
		}
	}
	console.table(list);

}
