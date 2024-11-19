// # worker-pool.js
import { AsyncResource } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import os from 'node:os';

const kTaskInfo = Symbol('kTaskInfo');
const kWorkerFreedEvent = Symbol('kWorkerFreedEvent');

class WorkerPoolTaskInfo extends AsyncResource {
	constructor(callback) {
		super('WorkerPoolTaskInfo');
		this.callback = callback;
	}

	done(err, result) {
		this.runInAsyncScope(this.callback, null, err, result);
		this.emitDestroy();
	}
}

// # WorkerPool()
// A worker pool class, taken from https://nodejs.org/api/
// async_context.html#using-asyncresource-for-a-worker-thread-pool
let id = 0;
export default class WorkerPool extends EventEmitter {

	// ## constructor(opts)
	constructor(opts = {}) {
		if (typeof opts === 'string' || opts instanceof URL) {
			opts = { url: opts };
		}
		const {
			url,
			n: numThreads = os.availableParallelism(),
			script = null,
		} = opts;
		super();
		this.url = url;
		this.script = script;
		this.numThreads = numThreads;
		this.workers = [];
		this.freeWorkers = [];
		this.tasks = [];

		for (let i = 0; i < numThreads; i++)
			this.addNewWorker();

		// Any time the kWorkerFreedEvent is emitted, dispatch the next task 
		// pending in the queue, if any.
		this.on(kWorkerFreedEvent, () => {
			if (this.tasks.length > 0) {
				const { task, callback } = this.tasks.shift();
				this.runCallback(task, callback);
			}
		});

	}

	// ## addNewWorker()
	addNewWorker() {
		const worker = new Worker(this.script ?? new URL(this.url), {
			eval: !!this.script,
		});
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
			let tasks = Object.values(worker[kTaskInfo]);
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
	runCallback(task, callback) {
		if (this.freeWorkers.length === 0) {
			// No free threads, wait until a worker thread becomes free.
			this.tasks.push({ task, callback });
			return;
		}

		// We're using a round robin strategy so shift a free worker, and put it 
		// back at the end of the queue.
		const worker = this.freeWorkers.shift();
		this.freeWorkers.push(worker);
		let taskId = id++;
		worker[kTaskInfo][taskId] = new WorkerPoolTaskInfo(callback);
		worker.postMessage({ id: taskId, task });

	}

	// ## run(task)
	// A promised version of `runCallback()`. That's a bit more ergonomic to 
	// work with.
	run(task) {
		return new Promise((resolve, reject) => {
			this.runCallback(task, (err, data) => {
				if (err) reject(err);
				else resolve(data);
			});
		});
	}

	// ## close()
	close() {
		for (const worker of this.workers) worker.terminate();
	}
}
