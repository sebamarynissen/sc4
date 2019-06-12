// # qfs.js
"use strict";
const { decompress, compress } = require('../src/build/Release/qfs.node');

// # decompress(buff)
// Export the JavaScript wrapper for decompressing QFS encoded data.
exports.decompress = function(buff) {

	// First 4 bytes are the compressed size. We don't need to pass this, so 
	// skip them.
	buff = Buffer.from(buff.buffer, buff.offset+4);
	const size = 0x10000*buff[2] + 0x100*buff[3] + buff[4];
	return decompress(buff, size);

};

// # compress(buff)
// Exports the JavaScript wrapper for compressing QFS encoded data.
exports.compress = function(buff) {
	buff = compress(buff, buff.byteLength);
	let target = Buffer.allocUnsafe(buff.byteLength+4);
	target.writeUInt32LE(target.byteLength);
	buff.copy(target, 4);
	return target;
};