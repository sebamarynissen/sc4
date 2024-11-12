// # menu-icon-prompt.js
import path from 'node:path';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import sea from 'node:sea';
import http from 'node:http';
import open from 'open';
import {
	createPrompt,
	useState,
	useMemo,
	usePrefix,
	makeTheme,
} from '@inquirer/core';

// The prompt that we use when requesting menu icons from the user. We'll do 
// this by starting a server where the browser is doing the job of compiling the 
// icons for us.
export const menuIcon = createPrompt((config, done) => {
	const { message } = config;
	const theme = makeTheme(config.theme);
	const [url, setUrl] = useState('');
	const [status, setStatus] = useState('idle');
	const prefix = usePrefix({ status, theme });
	useMemo(() => {
		const server = runServer();
		server.promises.listening().then(url => setUrl(url));
		server.promises.ready().then(buffer => {
			done(buffer);
			setStatus('done');
		});
		return server;
	}, []);
	return url ? `${prefix} ${message} ${status === 'done' ? theme.style.answer('<icon>') : ''}` : '';
});

// # runServer()
// Opens a server and returns a promise that returns when the server is running. 
// Use `server.ready()` to get the promise for when the icon was uploaded.
function runServer() {
	const ready = Promise.withResolvers();
	const listen = Promise.withResolvers();
	const closed = Promise.withResolvers();
	const send = getSendHandler();
	const server = http.createServer(async (req, res) => {
		if (req.url === '/favicon.ico') {
			res.statusCode = 404;
			res.end();
			return;
		} else if (req.url === '/upload') {
			let parts = [];
			for await (let chunk of req) {
				parts.push(chunk);
			}
			res.statusCode = 202;
			res.end();
			ready.resolve(Buffer.concat(parts));
		} else {
			let id = req.url === '/' ? '/index.html' : req.url;
			send(res, id);
		}
	});
	server.promises = {
		ready: () => ready.promise,
		listening: () => listen.promise,
		closed: () => closed.promise,
	};
	server.listen({
		host: '127.0.0.1',
		port: 0,
	}, () => {
		const { address, port } = server.address();
		const url = server.url = `http://${address}:${port}`;
		listen.resolve(url);
		open(url);
	});

	// Close the server again when ready.
	ready.promise.then(() => {
		server.closeAllConnections();
		server.close(() => closed.resolve());
	});
	return server;

}

// # getSendHandler()
function getSendHandler() {
	return sea.isSea() ? sendSea : sendNode;
}

// # sendSea(res, key)
function sendSea(res, key) {
	let asset = Buffer.from(sea.getAsset(`assets${key}`));
	sendType(res, key);
	res.end(asset);
}

// # sendNode();
function sendNode(res, key) {
	sendType(res, key);
	let filePath = import.meta.resolve(`#cli/assets${key}`);
	let stream = fs.createReadStream(new URL(filePath));
	stream.pipe(res);
}

// # sendType(res, file)
function sendType(res, file) {
	let ext = path.extname(file);
	res.setHeader('Content-Type', mimes[ext]);
}

const mimes = {
	'.html': 'text/html',
	'.png': 'image/png',
	'.js': 'text/javascript',
};
