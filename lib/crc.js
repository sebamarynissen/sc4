// # crc.js
const { crc } = require('./lib-cpp');
const IV = 0xffffffff;

module.exports = function(buff, offset, iv) {
	if (offset) {
		let start = buff.offset+offset;
		let length = buff.byteLength - offset;
		buff = Buffer.from(buff.buffer, start, length);
	}

	return crc(buff, buff.byteLength, isNaN(iv) ? IV : Number(iv));

	// See #4. If the data length is too high, we'll split it up in chunks and 
	// use the fact that a crc can be calculated in a streamified way.
	// if (buff.byteLength > MAX) {

	// 	// Code below doesn't seem to do the trick, let's try backwards.
	// 	let mem = isNaN(iv) ? 0xffffffff : Number(iv);
	// 	let i = 0;
	// 	let slices = [];
	// 	while (i < buff.byteLength) {

	// 		let length = Math.min(MAX, buff.byteLength-i);
	// 		let slice = Buffer.from(buff.buffer, buff.offset+i, length);
	// 		slices.push(slice);
	// 		i += MAX;

	// 		// Calculate our crc.
	// 		mem = crc(slice, slice.byteLength, mem);

	// 	}

	// 	// Doesn't do it as well... Gotta find some help here...
	// 	// let mem = isNaN(iv) ? 0xffffffff : Number(iv);
	// 	// let slices = [];
	// 	// let i = buff.byteLength;
	// 	// while (i > 0) {
	// 	// 	let start = Math.max(0, i-MAX);
	// 	// 	let slice = buff.slice(start, i);
	// 	// 	slices.push(slice);
	// 	// 	i -= MAX;

	// 	// 	mem = crc(slice, slice.byteLength, mem);

	// 	// }

	// 	// Done.
	// 	return mem;

	// } else {
	// 	return crc(buff, buff.byteLength, isNaN(iv) ? 0xffffffff : Number(iv));
	// }
};