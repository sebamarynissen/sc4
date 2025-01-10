// # city-count-command.ts
import path from 'node:path';
import { Savegame } from 'sc4/core';

type CityCountCommandOptions = {
	min?: number;
	sort?: boolean;
};

export function cityCount(file: string, options: CityCountCommandOptions) {
	let fullPath = path.resolve(process.cwd(), file);
	let dbpf = new Savegame(fullPath);
	let { min = 0 } = options;
	let table = dbpf
		.createContext()
		.getRecordCountTable()
		.filter(row => row.count >= min);
	if (options.sort) {
		table.sort((a, b) => b.count - a.count);
	}
	console.table(table);
}
