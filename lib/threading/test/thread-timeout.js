// # thread-timeout.js
import thread from 'sc4/threading/worker-thread.js';

thread(({ nr, max = 20 }) => new Promise(cb => {
	let ms = Math.random() * max | 0;
	setTimeout(() => cb(nr), ms);
}));
