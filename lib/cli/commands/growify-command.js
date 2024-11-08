// # growify-command.js
import path from 'node:path';
import fs from 'node:fs';
import { ZoneType } from 'sc4/core';
import * as api from 'sc4/api';
import logger from '#cli/logger.js';
import backup from '#cli/backup.js';

export async function growify(city, options) {

	// Ensure that the city is a valid savegame.
	let file = path.resolve(process.cwd(), city);
	let ext = path.extname(file);
	if (ext.toLowerCase() !== '.sc4' || !fs.existsSync(file)) {
		throw new Error(`${city} is not a SimCity 4 savegame!`);
	}

	// Convert the command options to options that the api accepts.
	let apiOptions = {
		logger,
		dbpf: file,
		output: options.output,
		historical: options.historical ?? true,
		save: true,
		backup,
	};
	if (options.residential) {
		apiOptions.residential = getZoneType({
			l: ZoneType.RLow,
			m: ZoneType.RMedium,
			h: ZoneType.RHigh,
		}, options.residential);
	}
	if (options.commercial) {
		apiOptions.commercial = getZoneType({
			l: ZoneType.CLow,
			m: ZoneType.CMedium,
			h: ZoneType.CHigh,
		}, options.commercial);
	}
	if (options.industrial) {
		apiOptions.industrial = getZoneType({
			m: ZoneType.IMedium,
			h: ZoneType.IHigh,
		}, options.industrial);
	}
	if (options.agricultural) apiOptions.agricultural = ZoneType.ILow;
	await api.growify(apiOptions);

}

function getZoneType(types, density) {
	if (density === true) return types.m;
	let type = types[density[0].toLowerCase()];
	if (!type) {
		throw new Error(`Unknown zone density ${density}!`);
	}
	return type;
}
