// # crc.js
const { crc } = require('./lib-cpp');
const IV = 0xffffffff;
const MAX = 250000;

module.exports = function(buff, offset, iv) {
	if (offset) {
		let start = buff.offset+offset;
		let length = buff.byteLength - offset;
		buff = Buffer.from(buff.buffer, start, length);
	}

	// See #4. Apparently the game doesn't calculate crcs for buffers larger 
	// than 250 000 bytes. It cuts them off.
	if (buff.byteLength > MAX) {
		buff = Buffer.from(buff.buffer, buff.offset, MAX);
	}

	return crc(buff, buff.byteLength, isNaN(iv) ? IV : Number(iv));

};