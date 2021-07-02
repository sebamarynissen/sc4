// # qfs.js
'use strict';
const cpp = require('sc4/qfs/cpp');
const js = require('sc4/qfs/js');

// Determine which implementation to use at runtime. C++ if possible, 
// JavaSrcipt otherwise.
const lib = cpp && cpp.decompress ? cpp : js;

// # decompress(buff)
// Export the JavaScript wrapper for decompressing QFS encoded data.
function decompress(buff) {

	// First 4 bytes are the compressed size. We don't need to pass this, so 
	// skip them. Note that we used to pass the *uncompressed* buffer size to 
	// C++ as well, but that's not required, it can decode it itself just fine!
	buff = buff.slice(4);
	return lib.decompress(buff);

}
exports.decompress = decompress;

// # compress(buff)
// Exports the JavaScript wrapper for compressing QFS encoded data.
function compress(buff) {
	buff = lib.compress(buff);
	let target = Buffer.allocUnsafe(buff.byteLength+4);
	target.writeUInt32LE(target.byteLength);
	buff.copy(target, 4);
	return target;
}
exports.compress = compress;
