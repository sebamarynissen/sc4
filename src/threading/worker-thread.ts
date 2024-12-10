// # worker-thread.js
import { parentPort } from 'node:worker_threads';
import type { StructuredCloneable } from 'type-fest';
type MaybePromise<T> = Promise<T> | T;
type TaskInfo = {
	id: string | number;
	task: any;
};

// Helper function for running code inside a worker thread that takes care of 
// the task ids automatically.
export default function workerThread(fn: (...args: any[]) => MaybePromise<StructuredCloneable>) {
	parentPort!.on('message', async ({ id, task }: TaskInfo) => {
		let result = await fn(task);
		parentPort!.postMessage({ id, type: 'result', result });
	});
}
