// # worker-pool.ts
import sea from 'node:sea';
import { WorkerPool as BaseWorkerPool } from 'sc4/threading';
import type { WorkerPoolOptions } from 'src/threading/worker-pool.js';

// # WorkerPool()
// Small helper class that overrides our basic worker pool so that we handle the 
// case of running in a sea environment.
export default class WorkerPool extends BaseWorkerPool {
	constructor(opts?: WorkerPoolOptions) {
		if (sea.isSea()) {
			const script = sea.getAsset('threads/plugin-index-thread.js', 'utf8');
			super({ ...opts, script });
		} else {
			const url = import.meta.resolve('./plugin-index-thread.js');
			super({ ...opts, url });
		}
	}
}
