// # crc.js
const { crc } = require('./lib-cpp');

module.exports = function(buff) {
	return crc(buff, buff.byteLength);
};