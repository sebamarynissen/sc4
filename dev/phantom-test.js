// # phantom-test.js
import path from 'node:path';
import { Savegame } from 'sc4/core';
import { chunk, hex } from 'sc4/utils';

const city = name => path.join(process.env.USERPROFILE, 'documents/SimCity 4/Regions/Experiments', name);

describe('A phantom affected city', function() {

	it('reads line item file', async function() {

		let file = city('City - Phantom.sc4');
		// let file = path.resolve(__dirname, 'files/City - Phantom.sc4');
		let dbpf = new Savegame(file);

		for (let building of dbpf.buildings) {
			let prop = building.sgprops.find(prop => {
				// let yes = [
				// 	0xEA54D287,
				// 	0xE9244B2E,
				// ].includes(prop.name);
				// return yes;
				return prop.name === 0xEA54D287;
			});

			// prop.value[0] = 100;
			console.log('prop', prop);
		// 	console.log('-'.repeat(100));

		}

		let index = new Map();
		for (let item of dbpf.lineItems) {
			index.set(item.mem, item);
			if (item.name === 'Elementary School') {
				// item.cost = item.expense;
				console.log(item);
				// item.expense = item.cost;
			}
		}

		// for (let budget of dbpf.departmentBudgetFile) {
		// 	console.log(budget.name);
		// 	for (let pointer of budget.lineItems) {
		// 		let item = index.get(+pointer);
		// 		console.log(' '.repeat(5), item.name, item.cost && Number(item.expense) / Number(item.cost));
		// 	}
		// }

		// let items = dbpf.lineItems;
		// for (let item of items) {
		// 	let hex = item.unknown2.toString('hex');
		// 	console.log(item.name.padStart(30, ' '), chunk([8, 8, 1, 8, 8, 8, 8], hex));
		// 	// console.log(item.name.padEnd(30, ' '), item.cost, item.expense);
		// }

		// let out = path.join(process.env.USERPROFILE, 'documents/SimCity 4/Regions/Experiments/City - Phantom.sc4');
		// await dbpf.save({ file: file });

	});

});
