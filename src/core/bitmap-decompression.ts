// # bitmap-compression.ts
// # decompress8bit(data)
// Decompresses an 8-bit encoded bitmap. Note that for now we don't use color 
// palettes and just assume grayscale. That's probably what SimCity 4 uses them 
// for anyway.
export function decompress8bit(
	data: Uint8Array,
	width: number,
	height: number,
) {
	const output = new Uint8Array(width*height*4);
	for (let i = 0; i < data.length; i++) {
		let value = data[i];
		let j = 4*i;
		output[j+2] = output[j+1] = output[j] = value;
		output[j+3] = 0xff;
	}
	return output;
}

// # decompressDXT3()
// Decompresses an image compressed in the DXT3 format to a bitmap (a Uint8Array 
// of rgba values).
export function decompressDXT3(
	dxtData: Uint8Array,
	width: number,
	height: number,
) {
	const rgbaData = new Uint8Array(width*height*4);
	let offset = 0;
	for (let y = 0; y < height; y += 4) {
		for (let x = 0; x < width; x += 4) {

			// Read 8 bytes of alpha
			const alphaValues = new Uint8Array(16);
			for (let i = 0; i < 8; i++) {
				const alphaByte = dxtData[offset+i];
				alphaValues[i*2] = (alphaByte & 0x0F)*17;
				alphaValues[i*2+1] = ((alphaByte >> 4) & 0x0F)*17;
			}

			// Read 8 bytes of color block
			const color0 = dxtData[offset+8] | (dxtData[offset+9] << 8);
			const color1 = dxtData[offset+10] | (dxtData[offset+11] << 8);
			const lookupTable = (
				dxtData[offset+12] |
				(dxtData[offset+13] << 8) | 
				(dxtData[offset+14] << 16) |
				(dxtData[offset+15] << 24)
			);

			// Read the min & max colors as RGB565.
			const c0 = unpack565(color0);
			const c1 = unpack565(color1);
			const colors = [
				[...c0, 255],
				[...c1, 255],
				[(2*c0[0]+c1[0])/3, (2*c0[1]+c1[1])/3, (2*c0[2]+c1[2])/3, 255],
				[(c0[0]+2*c1[0])/3, (c0[1]+2*c1[1])/3, (c0[2]+2*c1[2])/3, 255],
			];

			// Apply colors and alpha to 4×4 block
			for (let row = 0; row < 4; row++) {
				for (let col = 0; col < 4; col++) {
					const pixelIndex = (y+row)*width + (x+col);
					const rgbaIndex = pixelIndex*4;
					const lookupBits = (lookupTable >> (2*(row*4+col))) & 0x03;
					rgbaData[rgbaIndex] = colors[lookupBits][0];
					rgbaData[rgbaIndex + 1] = colors[lookupBits][1];
					rgbaData[rgbaIndex + 2] = colors[lookupBits][2];
					rgbaData[rgbaIndex + 3] = alphaValues[row * 4 + col];
				}
			}

			// Move to the next block.
			offset += 16;

		}
	}
	return rgbaData;
}

// # decompressDXT1()
// Decompresses an image compressed in the DXT1 format to a bitmap (a Uint8Array 
// of rgba values).
export function decompressDXT1(
	dxtData: Uint8Array,
	width: number,
	height: number,
) {
	const rgbaData = new Uint8Array(width*height*4);
	let offset = 0;
	for (let y = 0; y < height; y += 4) {
		for (let x = 0; x < width; x += 4) {

			// Read 2 color values
			const color0 = dxtData[offset] | (dxtData[offset+1] << 8);
			const color1 = dxtData[offset+2] | (dxtData[offset+3] << 8);
			const lookupTable = (
				dxtData[offset+4] |
				(dxtData[offset+5] << 8) |
				(dxtData[offset+6] << 16) |
				(dxtData[offset+7] << 24)
			);

			// If color0 > color1, then we're in normal mode (4 colors). 
			// Otherwise we're in transparent mode (3 colors + transparency).
			const c0 = unpack565(color0);
			const c1 = unpack565(color1);
			let colors;
			if (color0 > color1) {
				colors = [
					[...c0, 255],
					[...c1, 255],
					[(2*c0[0]+c1[0])/3,(2*c0[1]+c1[1])/3,(2*c0[2]+c1[2])/3,255],
					[(c0[0]+2*c1[0])/3,(c0[1]+2*c1[1])/3,(c0[2]+2*c1[2])/3, 255],
				];
			} else {
				colors = [
					[...c0, 255],
					[...c1, 255],
					[(c0[0]+c1[0])/2, (c0[1]+c1[1])/2, (c0[2]+c1[2])/2, 255],
					[0, 0, 0, 0],
				];
			}

			// Apply colors to the 4×4 block
			for (let row = 0; row < 4; row++) {
				for (let col = 0; col < 4; col++) {
					const pixelIndex = (y+row)*width + (x+col);
					const rgbaIndex = pixelIndex*4;
					const lookupBits = (lookupTable >> (2*(row*4 + col))) & 0x03;
					rgbaData[rgbaIndex] = colors[lookupBits][0];
					rgbaData[rgbaIndex + 1] = colors[lookupBits][1];
					rgbaData[rgbaIndex + 2] = colors[lookupBits][2];
					rgbaData[rgbaIndex + 3] = colors[lookupBits][3];
				}
			}

			// Move to the next 4x4 block.
			offset += 8;
		}
	}
	return rgbaData;
}

function unpack565(rgb565: number) {
	const r = ((rgb565 >> 11) & 0x1F) * (255 / 31);
	const g = ((rgb565 >> 5) & 0x3F) * (255 / 63);
	const b = (rgb565 & 0x1F) * (255 / 31);
	return [r, g, b, 0];
}
