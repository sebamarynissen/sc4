// # plop-all-command.js
import path from 'node:path';
import plop from 'sc4/api/plop-all-lots.js';
import logger from '#cli/logger.js';
import backup from '#cli/backup.js';
import parseList from '#cli/helpers/parse-list.js';

type PlopAllCommandOptions = {
	directory?: string;
	clear?: boolean;
	random?: string;
	bbox?: string;
	props?: boolean;
};

// # plopAll()
export async function plopAll(
	city: string,
	lots: string[],
	options: PlopAllCommandOptions = {},
) {

	let {
		directory,
		clear = false,
		random = undefined,
		bbox: bboxString,
		props,
	} = options;

	// The bbox still needs to be parsed it is given.
	let bbox: number[] | undefined;
	if (bboxString) {
		bbox = parseList(bboxString.replaceAll(/[[\]]/g, '')).map(x => +x);
	}
	await plop({
		lots,
		directory,
		city: path.resolve(process.env.SC4_REGIONS ?? process.cwd(), city),
		clear,
		bbox,
		random,
		props,
		save: true,
		logger,
		backup,
	});

}
