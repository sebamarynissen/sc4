// # parsers.ts
import { InvalidArgumentError } from 'commander';
import { FileType } from 'sc4/core';

export function number(value: string) {
	let parsedValue = +value;
	if (!Number.isFinite(parsedValue)) {
		throw new InvalidArgumentError('Not a number');
	}
	return parsedValue;
}

let lc = Object.fromEntries(
	Object
		.entries(FileType)
		.map(([type, value]) => [type.toLowerCase(), value]),
);
export function typeId(value: string) {
	if (value in lc) {
		return lc[value];
	}
	try {
		return number(value);
	} catch (e) {
		throw new InvalidArgumentError('Not a number or known file type');
	}
}
