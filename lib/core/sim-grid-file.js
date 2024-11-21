// # sim-grid.js
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';

const TypedArrays = {
	[FileType.SimGridUint8]: Uint8Array,
	[FileType.SimGridSint8]: Int8Array,
	[FileType.SimGridUint16]: Uint16Array,
	[FileType.SimGridSint16]: Int16Array,
	[FileType.SimGridUint32]: Uint32Array,
	[FileType.SimGridFloat32]: Float32Array,
};
const Readers = {
	[FileType.SimGridUint8]: Stream.prototype.uint8,
	[FileType.SimGridSint8]: Stream.prototype.int8,
	[FileType.SimGridUint16]: Stream.prototype.uint16,
	[FileType.SimGridSint16]: Stream.prototype.int16,
	[FileType.SimGridUint32]: Stream.prototype.uint32,
	[FileType.SimGridFloat32]: Stream.prototype.float,
};
const Writers = {
	[FileType.SimGridUint8]: WriteBuffer.prototype.uint8,
	[FileType.SimGridSint8]: WriteBuffer.prototype.int8,
	[FileType.SimGridUint16]: WriteBuffer.prototype.uint16,
	[FileType.SimGridSint16]: WriteBuffer.prototype.int16,
	[FileType.SimGridUint32]: WriteBuffer.prototype.uint32,
	[FileType.SimGridFloat32]: WriteBuffer.prototype.float,
};

// # SimGrid
// SimCity4 has different classes for each SimGrid, so we'll reflect this as 
// well. We want them to have similar behavior though, so we'll extend the class 
// from the base class automatically.
class SimGrid {

	static [Symbol.for('sc4.type.array')] = true;

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
		this.resolution = 0x00000001;
		this.resolutionPower = 0x00000000;
		this.xSize = 0x00000040;
		this.zSize = 0x00000040;
		this.u6 = 0x00000000;
		this.u7 = 0x00000000;
		this.u8 = 0x00000000;
		this.u9 = 0x00000000;
		this.data = null;
	}

	// ## parse(rs)
	parse(rs) {
		let start = rs.i;
		let size = rs.dword();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.u1 = rs.byte();
		this.type = rs.dword();
		this.dataId = rs.dword();
		this.resolution = rs.dword();
		this.resolutionPower = rs.dword();
		this.xSize = rs.dword();
		this.zSize = rs.dword();
		this.u6 = rs.dword();
		this.u7 = rs.dword();
		this.u8 = rs.dword();
		this.u9 = rs.dword();

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
		let diff = rs.i - start;
		if (diff !== size) {
			console.warn([
				'Error while reading SimGrid!',
				`Expected ${size} bytes, but read ${diff}!`,
			]);
		}

		// Done! Easy data access is available by calling createProxy(). Using 
		// this it's possible to access the data as if it were a 
		// multidimensional array.
		return this;

	}

	// ## toBuffer()
	toBuffer() {

		// Pre-allocate the header.
		let ws = new WriteBuffer();
		ws.dword(this.mem);
		ws.word(this.major);
		ws.byte(this.u1);
		ws.dword(this.type);
		ws.dword(this.dataId);
		ws.dword(this.resolution);
		ws.dword(this.resolutionPower);
		ws.dword(this.xSize);
		ws.dword(this.zSize);
		ws.dword(this.u6);
		ws.dword(this.u7);
		ws.dword(this.u8);
		ws.dword(this.u9);

		// Use the underlying buffer of our data view. At least on LE systems 
		// this should be good to be used directly.
		const writer = Writers[ this.type ];
		for (let value of this.data) {
			writer.call(ws, value);
		}
		return ws.seal();

	}

	// ## get(x, z)
	// Returns the value stored in cell (x, z)
	get(x, z) {
		let { zSize } = this;
		return this.data[ x*zSize + z ];
	}

	// ## set(x, z)
	// Sets the value stored in cell (x, z)
	set(x, z, value) {
		this.data[ x*this.zSize+z ] = value;
		return this;
	}

	// ## clear()
	// Clears the entire simgrid again.
	clear() {
		this.data.fill(0);
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
						let { zSize, data } = target;
						return data[ x*zSize + z];
					},
				});
			},
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

// # TypedSimGrid()
// Factory function that generates a typed SimGrid from the base class.
const hType = Symbol.for('sc4.type');
function TypedSimGrid(type) {
	return class extends SimGrid {
		static [hType] = type;
	};
}

export const SimGridUint8 = TypedSimGrid(FileType.SimGridUint8);
export const SimGridSint8 = TypedSimGrid(FileType.SimGridSint8);
export const SimGridUint16 = TypedSimGrid(FileType.SimGridUint16);
export const SimGridSint16 = TypedSimGrid(FileType.SimGridSint16);
export const SimGridUint32 = TypedSimGrid(FileType.SimGridUint32);
export const SimGridFloat32 = TypedSimGrid(FileType.SimGridFloat32);
