// # worker-pool.ts
import { AsyncResource } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import type { StructuredCloneable } from 'type-fest';

type WorkerPoolOptions = {
	url?: string | URL;
	n?: number;
	script?: string | null;
	ts?: boolean;
};

type TaskCallback = (...args: any[]) => any;
type Task = {
	task: StructuredCloneable;
	callback: TaskCallback;
};

type WorkerWithTaskInfo = Worker & {
	[kTaskInfo]: {
		[id: string]: WorkerPoolTaskInfo;
	};
};

const kTaskInfo = Symbol('kTaskInfo');
const kWorkerFreedEvent = Symbol('kWorkerFreedEvent');

class WorkerPoolTaskInfo extends AsyncResource {
	callback: TaskCallback;
	constructor(callback: TaskCallback) {
		super('WorkerPoolTaskInfo');
		this.callback = callback;
	}
	done(err: Error | null, result: any) {
		this.runInAsyncScope(this.callback, null, err, result);
		this.emitDestroy();
	}
}

// # WorkerPool()
// A worker pool class, taken from https://nodejs.org/api/
// async_context.html#using-asyncresource-for-a-worker-thread-pool
let id = 0;
export default class WorkerPool extends EventEmitter {
	url: string | undefined;
	ts: boolean;
	script: string | null;
	numThreads: number;
	workers: WorkerWithTaskInfo[];
	freeWorkers: WorkerWithTaskInfo[];
	tasks: Task[];

	// ## constructor(opts)
	constructor(opts: WorkerPoolOptions | string | URL = {}) {
		if (typeof opts === 'string' || opts instanceof URL) {
			opts = { url: String(opts) };
		}
		const {
			url,
			n: numThreads = os.availableParallelism(),
			script = null,
			ts = (
				url && String(url).endsWith('.ts') ||
				(typeof describe === 'function' && typeof it === 'function')
			),
		} = opts;
		super();
		this.url = url ? String(url) : undefined;
		this.ts = ts;
		this.script = script;
		this.numThreads = numThreads;
		this.workers = [];
		this.freeWorkers = [];
		this.tasks = [];

		for (let i = 0; i < this.numThreads; i++) {
			this.addNewWorker();
		}

		// Any time the kWorkerFreedEvent is emitted, dispatch the next task 
		// pending in the queue, if any.
		this.on(kWorkerFreedEvent, () => {
			if (this.tasks.length > 0) {
				const { task, callback } = this.tasks.shift()!;
				this.runCallback(task, callback);
			}
		});

	}

	// ## addNewWorker()
	// IMPORTANT! If we're running as tsx, then our esm loader is not 
	// automatically registered. Hence we'll figure out automatically whether 
	// we're running a TypeScript file or not. Note that as long as we haven't 
	// migrated, we still need to handle .js files as well!
	addNewWorker() {
		let worker;
		if (this.ts && this.url) {
			worker = new Worker(`
				import { register } from 'tsx/esm/api';
				register();
				await import(${JSON.stringify(this.url)});
			`, { eval: true }) as WorkerWithTaskInfo;
		} else {
			worker = new Worker(this.script ?? new URL(this.url!), {
				eval: !!this.script,
			}) as WorkerWithTaskInfo;
		}
		worker[kTaskInfo] = Object.create(null);
		worker.on('message', ({ type, id, result }) => {

			// In case of success: Call the callback that was passed to 
			// `runCallback`, remove the `TaskInfo` associated with the Worker, 
			// and mark it as free again.
			if (type === 'result') {
				worker[kTaskInfo][id].done(null, result);
				delete worker[kTaskInfo][id];
			} else if (type === 'block') {
				this.freeWorkers.splice(this.freeWorkers.indexOf(worker), 1);
			} else if (type === 'free') {
				this.freeWorkers.push(worker);
				this.emit(kWorkerFreedEvent);
			}

		});
		worker.on('error', (err) => {
			// In case of an uncaught exception: Call the callback that was 
			// passed to `runCallback` with the error.
			let tasks = Object.values(worker[kTaskInfo]) as WorkerPoolTaskInfo[];
			if (tasks.length > 0) {
				for (let task of tasks) {
					task.done(err, null);
				}
			} else {
				this.emit('error', err);
			}

			// Remove the worker from the list and start a new Worker to replace 
			// the current one.
			this.workers.splice(this.workers.indexOf(worker), 1);
			this.addNewWorker();
		});
		this.workers.push(worker);
		this.freeWorkers.push(worker);
		this.emit(kWorkerFreedEvent);
	}

	// ## runCallback(task, callback)
	runCallback(task: StructuredCloneable, callback: TaskCallback) {
		if (this.freeWorkers.length === 0) {
			// No free threads, wait until a worker thread becomes free.
			this.tasks.push({ task, callback });
			return;
		}

		// We're using a round robin strategy so shift a free worker, and put it 
		// back at the end of the queue.
		const worker = this.freeWorkers.shift()!;
		this.freeWorkers.push(worker);
		let taskId = id++;
		worker[kTaskInfo][taskId] = new WorkerPoolTaskInfo(callback);
		worker.postMessage({ id: taskId, task });

	}

	// ## run(task)
	// A promised version of `runCallback()`. That's a bit more ergonomic to 
	// work with.
	run(task: StructuredCloneable): Promise<unknown> {
		return new Promise((resolve, reject) => {
			this.runCallback(task, (err, data) => {
				if (err) reject(err);
				else resolve(data);
			});
		});
	}

	// ## getUsage()
	// Returns an array that contains how many tasks are running in each worker.
	getUsage() {
		return this.workers.map(worker => {
			return Object.keys(worker[kTaskInfo]).length;
		});
	}

	// ## close()
	close() {
		for (const worker of this.workers) worker.terminate();
	}
}
