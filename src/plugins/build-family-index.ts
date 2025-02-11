// # build-family-index.ts
import PQueue from 'p-queue';
import type PluginIndex from './plugin-index.js';
import { type Cohort, type Exemplar, type Entry, FileType, TGI } from 'sc4/core';
import { indexOf } from 'uint8array-extras';

type ExemplarLike = Exemplar | Cohort;
type BuildFamilyIndexOptions = {
	concurrency?: number;
};

// The property id 0x27812870 as 32-bit LE, as well as in text format.
const binarySequence = new Uint8Array([0x70, 0x28, 0x81, 0x27]);
const textSequence = new Uint8Array([48, 120, 50, 55, 56, 49, 50, 56, 55, 48]);

// # buildFamilyIndex(index)
// Builds up the index of all building & prop families, maximized for speed.
export default async function buildFamilyIndex(
	index: PluginIndex,
	opts: BuildFamilyIndexOptions = {},
) {
	const families = new Map<number, TGI[]>();
	const cache = new Map<Entry, Promise<number[] | undefined>>();
	const { concurrency = 4096 } = opts;
	const exemplars = index.findAll({ type: FileType.Exemplar });
	const queue = new PQueue({ concurrency });
	const tasks: Promise<any>[] = new Array(exemplars.length);
	for (let entry of exemplars) {

		// If the entry has group id, then we can tell it's a lot configurations 
		// exemplar, so no need to parse it in that casae.
		if (entry.group === 0xa8fbd372) continue;
		const task = queue.add(async () => {
			const propFamilies = await getFamilies(index, cache, entry);
			if (!propFamilies || propFamilies.length === 0) return;
			for (let family of propFamilies) {
				const tgis = families.get(family);
				if (tgis) {
					tgis.push(entry.tgi);
				} else {
					families.set(family, [entry.tgi]);
				}
			}
		});
		tasks.push(task);

	}
	await Promise.all(tasks);

	// We're not done yet. If a prop pack adds props to a Maxis family, then 
	// multiple of the *same* tgi might be present in the family array. We 
	// have to avoid this, so we need to filter the tgi's again to be unique.
	for (let [family, tgis] of families) {
		let had = new Set();
		let filtered = tgis.filter(tgi => {
			let id = tgi.toBigInt();
			if (!had.has(id)) {
				had.add(id);
				return true;
			} else {
				return false;
			}
		});
		families.set(family, filtered);
	}
	return families;
}

async function getFamilies(
	index: PluginIndex,
	cache: Map<Entry, Promise<number[] | undefined>>,
	entry: Entry<ExemplarLike>
): Promise<number[] | undefined> {

	// IMPORTANT! We won't just blindly read in the exemplar, because 
	// that requires us to parse all exemplars, also the non-prop 
	// exemplars. No, instead we will read in the raw decompressed 
	// buffer, and then we'll look whether the 0x27812870 byte sequence
	// (in reverse order because of Little Endian) is present. If not, 
	// this file does not need to be parsed.
	const buffer = await entry.decompressAsync();
	const seq = buffer[3] === 0x54 ? textSequence : binarySequence;
	const patternIndex = indexOf(buffer, seq);

	// If the index was found, cool, it's very likely that the prop 
	// belongs to a family. We will parse the exemplar now.
	if (patternIndex > -1) {
		const exemplar = await entry.readAsync();
		const families = exemplar.get(0x27812870);
		if (families) return families;
	}

	// If we didn't find any families by now, we'll check if there's a parent 
	// cohort.
	const dv = new DataView(buffer.buffer, buffer.byteOffset);
	const type = dv.getUint32(8, true);
	if (type === 0) return;
	const group = dv.getUint32(8, true);
	const instance = dv.getUint32(8, true);
	const parent = index.find({ type, group, instance });
	if (!parent) return;
	let promise = cache.get(parent);
	if (promise) return await promise;
	promise = getFamilies(index, cache, parent as Entry<Cohort>);
	cache.set(parent, promise);
	return await promise;

}
