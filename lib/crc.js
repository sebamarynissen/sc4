// # crc.js
const { crc } = require('../build/Release/lib-cpp.node');

module.exports = function(buff) {
	return crc(buff, buff.byteLength);
};