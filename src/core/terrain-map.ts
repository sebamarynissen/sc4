import Stream from './stream.js';
import WriteBuffer from './write-buffer.js';
import { FileType } from './enums.js';
import { kFileType } from './symbols.js';
import type { float } from 'sc4/types';

// Width of a single tile in meters.
const TILE_WIDTH = 16;

// Helper types
type Vector3 = [number, number, number];
type Vector2 = [number, number];

// # TerrainMap
// The class we use for representing the terrain in a city. Note that we 
// follow the convention of the game, so we use x and z coordinates. The y 
// coordinate represents the height!
export default class TerrainMap extends Array<Float32Array> {
	static [kFileType] = FileType.TerrainMap;
	major: number;
	xSize: number;
	zSize: number;
	private raw: Float32Array;

	// ## constructor(xSize, zSize)
	constructor(xSize: number = 0, zSize: number = xSize) {
		super();
		this.major = 0x0002;
		this.xSize = xSize + 1;
		this.zSize = zSize + 1;
		Object.defineProperty(this, 'raw', {
			writable: true,
			value: null,
		});
		this.fill();
	}

	// ## clone()
	clone(): TerrainMap {
		const clone = new TerrainMap(this.xSize - 1, this.zSize - 1);
		clone.raw.set(this.raw);
		return clone;
	}

	// ## fill()
	fill(): this {
		const raw = this.raw = new Float32Array(this.zSize * this.xSize);
		for (let z = 0; z < this.zSize; z++) {
			this[z] = new Float32Array(
				raw.buffer,
				z * Float32Array.BYTES_PER_ELEMENT * this.xSize,
				this.xSize,
			);
		}
		return this;
	}

	// ## parse(bufferOrStream)
	parse(bufferOrStream: Uint8Array | Stream): void {

		// Determine the size based on the buffer length alone.
		const rs = new Stream(bufferOrStream);
		this.xSize = this.zSize = Math.sqrt((rs.internalUint8Array.length - 2) / 4);
		this.fill();

		// Now actually read in all the values
		this.major = rs.word();
		for (let i = 0; i < this.raw.length; i++) {
			this.raw[i] = rs.float();
		}

	}

	// ## toBuffer()
	toBuffer(): Uint8Array {
		const ws = new WriteBuffer();
		ws.word(this.major);
		for (let i = 0; i < this.raw.length; i++) {
			ws.float(this.raw[i]);
		}
		return ws.toUint8Array();
	}

	// ## get(i, j)
	get(i: number, j: number): float {
		return this[j][i];
	}

	// ## set(i, j, h)
	set(i: number, j: number, h: float): this {
		this[j][i] = h;
		return this;
	}

	// ## isCliff(x, z, cliff = 0.5)
	// Internal helper function that checks if the given tile is to be 
	// considered as a cliff, meaning we need to flip the triangulation.
	isCliff(x: number, z: number, cliff: number = 0.5): boolean {
		const P: Vector3 = [0, this[z][x], 0];
		const Q: Vector3 = [TILE_WIDTH, this[z][x + 1], 0];
		const R: Vector3 = [0, this[z + 1][x], TILE_WIDTH];
		const S: Vector3 = [TILE_WIDTH, this[z + 1][x + 1], TILE_WIDTH];
		const n1 = normal(P, Q, S);
		const n2 = normal(P, S, R);
		const yy1 = (n1[1] ** 2) / sql(n1);
		const yy2 = (n2[1] ** 2) / sql(n2);
		return Math.max(yy1, yy2) < cliff;
	}

	// ## query(x, z, cliff = 0.5)
	// Performs a terrain query using interpolation. This means that the 
	// coordinates are given in *meters*, not in tiles! Note that the game 
	// normally triangulates from north-west to south-east, but this is 
	// changed for cliffs. The cliff threshold can be modded though, so we 
	// allow this to be specified as a parameter which defaults to 0.5 (it's 
	// the maxNormalYForCliff) value.
	query(x: number, z: number, cliff: number = 0.5): number {

		// Find the tile numbers and local coordinates first.
		const i = Math.floor(x / TILE_WIDTH);
		const j = Math.floor(z / TILE_WIDTH);
		const t = (x - TILE_WIDTH * i) / TILE_WIDTH;
		const s = (z - TILE_WIDTH * j) / TILE_WIDTH;

		// Handle edge cases
		if (t === 0 && s === 0) {
			return this[j][i];
		} else if (t === 0) {
			return (1 - s) * this[j][i] + s * this[j + 1][i];
		} else if (s === 0) {
			return (1 - t) * this[j][i] + t * this[j][i + 1];
		}

		if (!this.isCliff(i, j, cliff)) {
			const P: Vector3 = [0, 0, this[j][i]];
			const Q: Vector3 = [1, 1, this[j + 1][i + 1]];
			const R: Vector3 = t > s ? [1, 0, this[j][i + 1]] : [0, 1, this[j + 1][i]];
			return ipol(P, Q, R, [t, s]);
		} else {
			const P: Vector3 = [1, 0, this[j][i + 1]];
			const Q: Vector3 = [0, 1, this[j + 1][i]];
			const R: Vector3 = t > 1 - s ? [1, 1, this[j + 1][i + 1]] : [0, 0, this[j][i]];
			return ipol(P, Q, R, [t, s]);
		}

	}

	// ## contour(i, j)
	// Returns the array containing the height values allong the contour of 
	// the given tile.
	contour(i: number, j: number): number[] {
		return [
			this[j][i],
			this[j][i + 1],
			this[j + 1][i + 1],
			this[j + 1][i],
		];
	}

	// ## flatten(i, j, h)
	// Flattens the tile (i, j). By default we set the *minimum* height value.
	flatten(i: number, j: number, h: number = Math.min(...this.contour(i, j))): this {
		this[j][i] = this[j][i + 1] = this[j + 1][i] = this[j + 1][i + 1] = h;
		return this;
	}

	// ## egalizeX(i, j)
	// Egalizes the tile in the x-direction. This makes the terrain suitable 
	// for drawing a road over it for example.
	egalizeX(i: number, j: number): this {
		for (let di = 0; di < 2; di++) {
			const ii = i + di;
			const h = Math.min(this[j][ii], this[j + 1][ii]);
			this[j][ii] = h;
			this[j + 1][ii] = h;
		}
		return this;
	}

	// ## egalizeZ(i, j)
	// Egalizes the tile in the z direction.
	egalizeZ(i: number, j: number): this {
		for (let dj = 0; dj < 2; dj++) {
			const jj = j + dj;
			const h = Math.min(this[jj][i], this[jj][i + 1]);
			this[jj][i] = h;
			this[jj][i + 1] = h;
		}
		return this;
	}
}

// # normal(P, Q, R)
// Calculates the normal vector for the plane going through the given three 
// points.
function normal(P: Vector3, Q: Vector3, R: Vector3): Vector3 {
	const u: Vector3 = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]];
	const v: Vector3 = [R[0] - P[0], R[1] - P[1], R[2] - P[2]];
	const a = u[2] * v[1] - u[1] * v[2];
	const b = u[0] * v[2] - u[2] * v[0];
	const c = u[1] * v[0] - u[0] * v[1];
	return [a, b, c];
}

// # sql(v)
// Finds the *squared* length of the given vector
function sql(v: Vector3): number {
	return v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
}

// # ipol(P, Q, R, [x, z])
// Helper function for triangular interpolation. It accepts three points and 
// finds the equation of the plane going to those three points.
function ipol(P: Vector3, Q: Vector3, R: Vector3, [x, z]: Vector2): number {
	const [a, b, c] = normal(P, Q, R);
	const d = P[0] * a + P[1] * b + P[2] * c;
	return (d - a * x - b * z) / c;
}
