// # city-pointer-command.ts
import path from 'node:path';
import { Savegame } from 'sc4/core';
import { inspect } from 'sc4/utils';
import logger from '#cli/logger.js';

export function cityPointer(city: string, pointer: number | string) {
	let file = path.resolve(process.cwd(), city);
	let dbpf = new Savegame(file);
	let address = +pointer;
	logger.info('Searching for', inspect.hex(address));
	let ctx = dbpf.createContext();
	let records = ctx.getFlatRecordList();
	let record = records.find(record => record.pointer.address === address);
	if (!record) {
		logger.error('Pointer not found!');
		return 1;
	}
	console.log({
		class: record.label,
		pointer: record.pointer,
		offset: record.offset,
		buffer: record.buffer,
	});
}
