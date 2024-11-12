// # menu-icon-prompt.js
import { fileURLToPath } from 'node:url';
import express from 'express';
import bodyParser from 'body-parser';
import open from 'open';

// # menuIcon()
// The prompt that we use when requesting menu icons from the user. We'll do 
// this by starting a server where the browser is doing the job of compiling the 
// icons for us.
export async function menuIcon() {

	const file = path => fileURLToPath(import.meta.resolve(path));
	const app = express();
	app.get('/', (req, res) => res.sendFile(file('#cli/assets/index.html')));
	app.get('/script.js', (req, res) => res.sendFile(file('#cli/assets/script.js')));
	app.get('/overlay.png', (req, res) => res.sendFile(file('#cli/assets/overlay.png')));

	const { promise, resolve } = Promise.withResolvers();
	app.post('/upload', bodyParser.raw({ type: 'image/png' }), (req, res) => {
		resolve(req.body);
		res.sendStatus(202);
	});

	const server = app.listen({
		host: '127.0.0.1',
		port: 0,
	}, () => {
		const { address, port } = server.address();
		const url = `http://${address}:${port}`;
		open(url);
	});

	// Now wait for the icon to be uploaded as a buffer, and then close the 
	// server again.
	let buffer = await promise;
	server.close();
	return buffer;

}
