// # grid-data.js
"use strict";
const Stream = require('./stream');
const { chunk } = require('./util');

const TypedArrays = {
	0x49b9e602: Uint8Array,
	0x49b9e603: Int8Array,
	0x49b9e604: Uint16Array,
	0x49b9e605: Int16Array,
	0x49b9e606: Uint32Array,
	0x49b9e60a: Float32Array
};
const Readers = {
	0x49b9e602: Stream.prototype.uint8,
	0x49b9e603: Stream.prototype.int8,
	0x49b9e604: Stream.prototype.uint16,
	0x49b9e605: Stream.prototype.int16,
	0x49b9e606: Stream.prototype.uint32,
	0x49b9e60a: Stream.prototype.float
};

// # SimGrid
module.exports = class SimGrid {

	// ## constructor()
	constructor() {


		// Note: I think some of the unknowns identifies the data type, where 
		// 0x01 is UInt8 etc. Not sure though, we should investigate this 
		// deeper.
		this.crc = 0x00000000;
		this.mem = 0x00000000;
		this.major = 0x0001;
		this.u1 = 0x01;
		this.type = 0x00000000;
		this.dataId = 0x00000000;
		this.u4 = 0x00000001;
		this.u5 = 0x00000000;
		this.xSize = 0x00000040;
		this.zSize = 0x00000040;
		this.u6 = 0x00000000;
		this.u7 = 0x00000000;
		this.u8 = 0x00000000;
		this.u9 = 0x00000000;
		this.data = null;
	}

	// ## parse(buff, read)
	parse(buff, read) {
		let rs = new Stream(buff);
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.u1 = rs.byte();
		this.type = rs.dword();
		this.dataId = rs.dword();
		this.u4 = rs.dword();
		this.u5 = rs.dword();
		this.xSize = rs.dword();
		this.zSize = rs.dword();
		this.u6 = rs.dword();
		this.u7 = rs.dword();
		this.u8 = rs.dword();
		this.u9 = rs.dword();

		// let format = '4 4 4 2 1 4 4 4 4 4 4 4 4 4'.split(' ').map(x => 2*x);
		// let header = buff.slice(0, 55).toString('hex');
		// console.log(chunk(format, header));
		// console.log('rest', Math.sqrt(buff.byteLength-55));

		// Don't know if multiple values are possible here, the SInt8 does 
		// some pretty weird stuff... Anyway, for now we'll just read in the 
		// rest into the appropriate underlying array type.
		// Note: we could directly copy the arraybuffer, but it's pretty error 
		// prone apparently, especially with the offsets and stuff. Hence 
		// we'll write in manually.
		const Typed = TypedArrays[ this.type ];
		const reader = Readers[ this.type ];
		const count = this.xSize * this.zSize;
		let data = this.data = new Typed(count);
		for (let i = 0; i < count; i++) {
			data[i] = reader.call(rs);
		}

		// Ensure that we've read everything correctly.
		if (rs.i !== size) {
			console.warn([
				'Error while reading SimGrid!',
				`Expected ${size} bytes, but read ${rs.i}!`
			]);
		}

		// Done! Easy data access is available by calling createProxy(). Using 
		// this it's possible to access the data as if it were a 
		// multidimensional array.
		return this;

	}

	// ## createProxy()
	// Creates a data proxy so that we can access the data in an array-like 
	// way.
	createProxy() {
		return new Proxy(this, {
			get(target, prop, receiver) {
				let x = +prop;
				return new Proxy(target, {
					get(target, prop, receiver) {
						let z = +prop;
						let { zSize, data} = target;
						return data[ x*zSize + z];
					}
				});
			}
		});
	}

	// ## paint()
	// Creates a visual representation of the sim grid on a canvas. Of course 
	// this can only be used in HTML environments that properly support canvas!
	paint() {
		let canvas = document.createElement('canvas');
		canvas.width = this.xSize;
		canvas.height = this.zSize;

		// Find the max value in the data.
		const data = this.data;
		let max = Math.max(...data);
		if (max === 0) max = 1;

		// Create a canvas context.
		let ctx = canvas.getContext('2d');
		let imgData = ctx.createImageData(canvas.width, canvas.height);

		// Fill up the image data. Note that we have to flip unfortunately, 
		// but that's manageable.
		for (let z = 0; z < this.zSize; z++) {
			for (let x = 0; x < this.xSize; x++) {
				let value = data[ x*this.zSize+z ];
				let offset = 4*(z*this.xSize+x);
				let alpha = (value / max)*0xff;
				imgData.data[offset+3] = alpha;
			}
		}
		ctx.putImageData(imgData, 0, 0);

		return canvas;

	}

}