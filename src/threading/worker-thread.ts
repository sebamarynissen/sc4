// # worker-thread.js
import { isMainThread, parentPort } from 'node:worker_threads';
import type { StructuredCloneable } from 'type-fest';
type MaybePromise<T> = Promise<T> | T;
type TaskInfo = {
	id: string | number;
	task: any;
};

// Helper function for running code inside a worker thread that takes care of 
// the task ids automatically. It also ensures that we can run both in the main 
// thread, as in the worker thread.
export default function workerThread(fn: (...args: any[]) => MaybePromise<StructuredCloneable>) {
	if (isMainThread) {
		return function(task: StructuredCloneable) {
			return fn(task);
		};
	} else {
		parentPort!.on('message', async ({ id, task }: TaskInfo) => {
			let result = await fn(task);
			parentPort!.postMessage({ id, type: 'result', result });
		});
	}
}
