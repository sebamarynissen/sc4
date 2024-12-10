// # worker-pool-test.js
import { expect } from 'chai';
import chalk from 'chalk';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import WorkerPool from '../worker-pool.js';
import { uint8ArrayToString } from 'uint8array-extras';

// # logUsage()
// Helper function for logging the current usage of a worker pool.
function logUsage(pool: WorkerPool) {
	return pool.getUsage().map(n => {
		let color = ['gray', 'cyan', 'green', 'yellow', 'red', 'magentaBright'][n] || 'magenta';
		return chalk[color](n);
	}).join(' ');
	// console.log(usage);
}

describe('A worker pool', function() {

	this.slow(1000);

	it('accepts a url', async function() {

		let pool = new WorkerPool({
			n: 1,
			url: import.meta.resolve('./thread-timeout.js'),
		});
		let tasks: Promise<any>[] = [];
		for (let i = 0; i < 32; i++) {
			let task = pool.run({ nr: i, max: 20 });
			tasks.push(task);
		}
		let result = await Promise.all(tasks);
		pool.close();
		expect(result).to.eql(Array(32).fill(0).map((_, i) => i));

	});

	it('accepts bundled source code', async function() {

		let source = new URL(import.meta.resolve('./thread-timeout.js'));
		let { outputFiles: [{ contents: bundle }] } = await esbuild.build({
			entryPoints: [fileURLToPath(source)],
			bundle: true,
			platform: 'node',
			target: 'node22',
			format: 'cjs',
			write: false,
		});

		let pool = new WorkerPool({ script: uint8ArrayToString(bundle) });
		let tasks: Promise<any>[] = [];
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
		expect(result).to.eql(Array(n).fill(0).map((_, i) => i));

	});

});
