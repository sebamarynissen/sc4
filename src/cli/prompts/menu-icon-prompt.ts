// # menu-icon-prompt.js
import path from 'node:path';
import fs from 'node:fs';
import sea from 'node:sea';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import open from 'open';
import {
	createPrompt,
	useState,
	useMemo,
	usePrefix,
	makeTheme,
    type Theme,
} from '@inquirer/core';
import { concatUint8Arrays, isUint8Array, uint8ArrayToBase64 } from 'uint8array-extras';
import type { AddressInfo } from 'node:net';

type MenuIconPromptOptions = {
	message: string;
	default?: Uint8Array;
	theme?: Theme;
};

// The prompt that we use when requesting menu icons from the user. We'll do 
// this by starting a server where the browser is doing the job of compiling the 
// icons for us.
export const menuIcon = createPrompt<Uint8Array, MenuIconPromptOptions>((config, done) => {
	const { message } = config;
	const theme = makeTheme(config.theme);
	const [url, setUrl] = useState('');
	const [status, setStatus] = useState('idle');
	const [address, setAddress] = useState('');
	const prefix = usePrefix({ status, theme });
	useMemo(() => {
		const { default: file, ...rest } = config;
		const { server, promises } = runServer({
			...file && { default: defaultToUrl(file) },
			...rest,
		});
		promises.listening().then(url => {
			setUrl(url);
			setAddress(theme.style.help(`(Visit ${url} if the browser doesn't open)`));
		});
		promises.ready().then(buffer => {
			done(buffer);
			setStatus('done');
		});
		return server;
	}, []);
	return url ? `${prefix} ${message} ${status === 'done' ? theme.style.answer('<icon>') : address }` : '';
});

// # defaultToUrl(file)
function defaultToUrl(file: Uint8Array | string) {
	if (isUint8Array(file)) {
		return `data:image/png;base64,${uint8ArrayToBase64(file)}`;
	} else {
		return pathToFileURL(file);
	}
}

// # runServer(config)
// Opens a server and returns a promise that returns when the server is running. 
// Use `server.ready()` to get the promise for when the icon was uploaded.
function runServer(config: Omit<MenuIconPromptOptions, 'default'>) {
	const ready = Promise.withResolvers<Uint8Array>();
	const listen = Promise.withResolvers<string>();
	const closed = Promise.withResolvers<undefined>();
	const send = getSendHandler();
	const server = http.createServer(handleError(async (req, res) => {
		if (req.url === '/data') {
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify(config));
		} else if (req.url === '/favicon.ico') {
			res.statusCode = 404;
			res.end();
		} else if (req.url!.startsWith('/fetch?')) {
			let parsed = new URL(req.url!, 'http://127.0.0.1');
			let url = new URL(parsed.searchParams.get('url')!);
			if (url.protocol === 'file:') {
				fs.createReadStream(url).pipe(res);
			} else {
				let buffer = await fetch(url).then(res => res.arrayBuffer());
				res.end(new Uint8Array(buffer));
			}
		} else if (req.url === '/upload') {
			let parts: Uint8Array[] = [];
			for await (let chunk of req) {
				parts.push(chunk as Uint8Array);
			}
			res.statusCode = 202;
			res.end();
			ready.resolve(concatUint8Arrays(parts));
		} else {
			let id = req.url === '/' ? '/index.html' : req.url!;
			send(res, id);
		}
	}));
	const promises = {
		ready: () => ready.promise,
		listening: () => listen.promise,
		closed: () => closed.promise,
	};
	server.listen({
		host: '127.0.0.1',
		port: 0,
	}, () => {
		const { address, port } = server.address() as AddressInfo;
		const url = `http://${address}:${port}`;
		listen.resolve(url);
		open(url);
	});

	// Close the server again when ready.
	ready.promise.then(() => {
		server.closeAllConnections();
		server.close(() => closed.resolve(void 0));
	});
	return { server, promises };

}
// # handleError(fn)
function handleError(fn: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<any>) {
	return async (req: http.IncomingMessage, res: http.ServerResponse) => {
		try {
			return await fn(req, res);
		} catch (e) {
			res.statusCode = 500;
			res.end(e.message);
		}
	};
}

// # getSendHandler()
function getSendHandler() {
	return sea.isSea() ? sendSea : sendNode;
}

// # sendSea(res, key)
function sendSea(res: http.ServerResponse, key: string) {
	let asset = new Uint8Array(sea.getAsset(`assets${key}`));
	sendType(res, key);
	res.end(asset);
}

// # sendNode();
function sendNode(res: http.ServerResponse, key: string) {
	sendType(res, key);
	let filePath = import.meta.resolve(`#cli/assets${key}`);
	let stream = fs.createReadStream(new URL(filePath));
	stream.pipe(res);
}

// # sendType(res, file)
function sendType(res: http.ServerResponse, file: string) {
	let ext = path.extname(file) as keyof typeof mimes;
	res.setHeader('Content-Type', mimes[ext]);
}

const mimes = {
	'.html': 'text/html',
	'.png': 'image/png',
	'.js': 'text/javascript',
};
