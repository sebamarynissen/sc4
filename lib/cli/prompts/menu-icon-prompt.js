// # menu-icon-prompt.js
import path from 'node:path';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import sea from 'node:sea';
import http from 'node:http';
import open from 'open';

// # menuIcon()
// The prompt that we use when requesting menu icons from the user. We'll do 
// this by starting a server where the browser is doing the job of compiling the 
// icons for us.
export async function menuIcon() {

	const { promise, resolve } = Promise.withResolvers();
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
			resolve(Buffer.concat(parts));
		} else {
			let id = req.url === '/' ? '/index.html' : req.url;
			send(res, id);
		}
	});
	server.listen({
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
