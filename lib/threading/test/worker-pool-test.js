// # worker-pool-test.js
import { expect } from 'chai';
import chalk from 'chalk';
import fs from 'node:fs';
import WorkerPool from '../worker-pool.js';

// # logUsage()
// Helper function for logging the current usage of a worker pool.
function logUsage(pool) {
	return pool.getUsage().map(n => {
		let color = ['gray', 'cyan', 'green', 'yellow', 'red', 'magentaBright'][n] || 'magenta';
		return chalk[color](n);
	}).join(' ');
	// console.log(usage);
}

describe('A worker pool', function(argument) {

	this.slow(1000);

	it('accepts a url', async function() {

		let pool = new WorkerPool({ url: import.meta.resolve('./thread-timeout.js') });
		let tasks = [];
		for (let i = 0; i < 32; i++) {
			let task = pool.run({ nr: i, max: 20 });
			tasks.push(task);
		}
		let result = await Promise.all(tasks);
		pool.close();
		expect(result).to.eql(Array(32).fill().map((_, i) => i));

	});

	it('accepts source code', async function() {

		let script = fs.readFileSync(new URL(import.meta.resolve('./thread-timeout.js')))+'';
		let pool = new WorkerPool({ script });
		let tasks = [];
		let n = 64;
		for (let i = 0; i < n; i++) {
			let task = pool.run({ nr: i })
				.then(nr => {
					logUsage(pool);
					return nr;
				});
			tasks.push(task);
		}
		let result = await Promise.all(tasks);
		pool.close();
		expect(result).to.eql(Array(n).fill().map((_, i) => i));

	});

});
