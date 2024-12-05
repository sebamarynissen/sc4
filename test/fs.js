// # fs.js
// Our goal is to make the entire module independent of the Node.js buffer - at 
// least the core functionality - so in order to make sure that we don't 
// accidentally rely on it, we wrap the filesystem access functions to return 
// actual Uint8Arrays instead of Buffers.
import fs from 'node:fs';

export function readFileSync(file) {
	return wrap(fs.readFileSync(file));
}

export const { existsSync } = fs;

export const promises = {
	async readFile(file) {
		return wrap(await fs.promises.readFile);
	},
};

function wrap(buffer) {
	return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export default { readFileSync, existsSync };
