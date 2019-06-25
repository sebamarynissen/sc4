// # crc.js
const { crc } = require('./lib-cpp');

module.exports = function(buff, offset) {
	if (offset) {
		let start = buff.offset+offset;
		let length = buff.byteLength - offset;
		buff = Buffer.from(buff.buffer, start, length);
	}
	return crc(buff, buff.byteLength);
};