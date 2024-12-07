// # sim-grid.js
import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType, kFileTypeArray } from './symbols.js';
import type { FileTypeValue } from './types.js';
import type { ConstructorOptions } from 'sc4/types';

const TypedArrays = {
	[FileType.SimGridUint8]: Uint8Array,
	[FileType.SimGridSint8]: Int8Array,
	[FileType.SimGridUint16]: Uint16Array,
	[FileType.SimGridSint16]: Int16Array,
	[FileType.SimGridUint32]: Uint32Array,
	[FileType.SimGridFloat32]: Float32Array,
} as const;
const Readers = {
	[FileType.SimGridUint8]: Stream.prototype.uint8,
	[FileType.SimGridSint8]: Stream.prototype.int8,
	[FileType.SimGridUint16]: Stream.prototype.uint16,
	[FileType.SimGridSint16]: Stream.prototype.int16,
	[FileType.SimGridUint32]: Stream.prototype.uint32,
	[FileType.SimGridFloat32]: Stream.prototype.float,
} as const;
const Writers = {
	[FileType.SimGridUint8]: WriteBuffer.prototype.uint8,
	[FileType.SimGridSint8]: WriteBuffer.prototype.int8,
	[FileType.SimGridUint16]: WriteBuffer.prototype.uint16,
	[FileType.SimGridSint16]: WriteBuffer.prototype.int16,
	[FileType.SimGridUint32]: WriteBuffer.prototype.uint32,
	[FileType.SimGridFloat32]: WriteBuffer.prototype.float,
} as const;

type SimGridType = {
	[K in keyof typeof TypedArrays as number]: K
}[FileTypeValue];
type SimGridTypedArray<T extends SimGridType> = InstanceType<(typeof TypedArrays)[T]>;

// # getTypedArray(type)
// Returns the typed array constructor to use for a specific type of SimGrid, 
// independent.
function getTypedArray<T extends SimGridType>(type: T) {
	return TypedArrays[type];
}

// The resolutions & powers have to come from a specific set of values.
type Resolution = 1 | 2 | 4 | 8 | 16 | 32 | 64;
type ResolutionExponent = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// The size of the grid depends on the city size and resolution. If the 
type GridSize = 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256;

// The options that can be specified to the constructor are anything that's 
// allowed.
type SimGridOptions<T extends SimGridType> = Omit<ConstructorOptions<SimGrid<T>>, 'type'>;

// # SimGrid
// SimCity4 has different classes for each SimGrid, so we'll reflect this as 
// well. We want them to have similar behavior though, so we'll extend the class 
// from the base class automatically.
abstract class SimGrid<T extends SimGridType> {

	// Note: I think some of the unknowns identifies the data type, where 
	// 0x01 is UInt8 etc. Not sure though, we should investigate this 
	// deeper.
	crc = 0x00000000;
	mem = 0x00000000;
	major = 0x0001;
	u1 = 0x01;
	type: T;
	data: SimGridTypedArray<T>;
	dataId = 0x00000000;
	resolution: Resolution = 0x00000001;
	resolutionExponent: ResolutionExponent = 0x00000000;
	xSize: GridSize = 0x00000040;
	zSize: GridSize = 0x00000040;
	u6 = 0x00000000;
	u7 = 0x00000000;
	u8 = 0x00000000;
	u9 = 0x00000000;

	// ## parse(rs)
	parse(rs: Stream) {
		rs.size();
		this.crc = rs.dword();
		this.mem = rs.dword();
		this.major = rs.word();
		this.u1 = rs.byte();
		this.type = rs.type() as T;
		this.dataId = rs.dword();
		this.resolution = rs.dword() as Resolution;
		this.resolutionExponent = rs.dword() as ResolutionExponent;
		this.xSize = rs.dword() as GridSize;
		this.zSize = rs.dword() as GridSize;
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
		const TypedArray = getTypedArray(this.type);
		const reader = Readers[this.type];
		const count = this.xSize * this.zSize;
		let data = this.data = new TypedArray(count) as SimGridTypedArray<T>;
		for (let i = 0; i < count; i++) {
			data[i] = reader.call(rs);
		}

		// Ensure that we've read everything correctly.
		rs.assert();

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
		ws.dword(this.resolutionExponent);
		ws.dword(this.xSize);
		ws.dword(this.zSize);
		ws.dword(this.u6);
		ws.dword(this.u7);
		ws.dword(this.u8);
		ws.dword(this.u9);

		// Use the underlying buffer of our data view. At least on LE systems 
		// this should be good to be used directly.
		const writer = Writers[this.type];
		for (let value of this.data) {
			writer.call(ws, value);
		}
		return ws.seal();

	}

	// ## get(x, z)
	// Returns the value stored in cell (x, z)
	get(x: number, z: number) {
		let { zSize } = this;
		return this.data[x*zSize + z];
	}

	// ## set(x, z)
	// Sets the value stored in cell (x, z)
	set(x: number, z: number, value: number) {
		this.data[x*this.zSize+z] = value;
		return this;
	}

	// ## clear(value)
	// Clears the entire simgrid again. Note that some simgrids might be cleared 
	// with different values - like -128 for exammple - so this need sto be 
	// customizable.
	clear(value: number = 0) {
		this.data.fill(value);
	}

	// ## createProxy()
	// Creates a data proxy so that we can access the data in an array-like 
	// way.
	createProxy() {
		return new Proxy(this, {
			get(target, prop: string) {
				let x = +prop;
				return new Proxy(target, {
					get(target, prop: string) {
						let z = +prop;
						let { zSize, data } = target;
						return data[x*zSize + z];
					},
				});
			},
		});
	}

}

// Helper function for creating the actual class.
function createClass<T extends SimGridType>(type: T) {
	return class extends SimGrid<T> {
		type = type;
		static [kFileType] = type;
		static [kFileTypeArray] = type;

		// ## constructor()
		// constructor(opts?: Partial<ConditionalExcept<T, Function>>) {
		// 	super();
		// 	Object.assign(this, opts);
		// }

	};
}

export class SimGridUint8 extends createClass<typeof FileType.SimGridUint8>(FileType.SimGridUint8) {};
export class SimGridSint8 extends createClass<typeof FileType.SimGridSint8>(FileType.SimGridSint8) {};
export class SimGridUint16 extends createClass<typeof FileType.SimGridUint16>(FileType.SimGridUint16) {};
export class SimGridSint16 extends createClass<typeof FileType.SimGridSint16>(FileType.SimGridSint16) {};
export class SimGridUint32 extends createClass<typeof FileType.SimGridUint32>(FileType.SimGridUint32) {};
export class SimGridFloat32 extends createClass<typeof FileType.SimGridFloat32>(FileType.SimGridFloat32) {}
