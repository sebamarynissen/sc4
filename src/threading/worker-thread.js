// # worker-thread.js
import { parentPort } from 'node:worker_threads';

// Helper function for running code inside a worker thread that takes care of 
// the task ids automatically.
export default function workerThread(fn) {
	parentPort.on('message', async ({ id, task }) => {
		let result = await fn(task);
		parentPort.postMessage({ id, type: 'result', result });
	});
}
