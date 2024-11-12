// # menu-icon-prompt.js
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import sea from 'node:sea';
import express from 'express';
import bodyParser from 'body-parser';
import open from 'open';

// # menuIcon()
// The prompt that we use when requesting menu icons from the user. We'll do 
// this by starting a server where the browser is doing the job of compiling the 
// icons for us.
export async function menuIcon() {

	const app = express();
	if (sea.isSea()) {
		const asset = key => (req, res) => {
			let file = `assets/${key}`;
			let type = mimes[path.extname(file)];
			res.header('Content-Type', type);
			res.send(Buffer.from(sea.getAsset(`assets/${key}`)));
		};
		app.get('/', asset('index.html'));
		app.get('/script.js', asset('script.js'));
		app.get('/overlay.png', asset('overlay.png'));
	} else {
		const file = key => (req, res) => {
			res.sendFile(
				fileURLToPath(import.meta.resolve(`#cli/assets/${key}`)),
			);
		};
		app.get('/', file('index.html'));
		app.get('/script.js', file('script.js'));
		app.get('/overlay.png', file('overlay.png'));
	}

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
	await new Promise(resolve => {
		server.closeAllConnections();
		server.close(() => resolve());
	});
	return buffer;

}

const mimes = {
	'.html': 'text/html',
	'.png': 'image/png',
	'.js': 'text/javascript',
};
