// # thread-timeout.ts
import { thread } from 'sc4/threading';

thread(({ nr, max = 20 }) => new Promise(cb => {
	let ms = Math.random() * max | 0;
	setTimeout(() => cb(nr), ms);
}));
