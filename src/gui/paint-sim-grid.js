// ## paint(grid)
// Creates a visual representation of the sim grid on a canvas. Of course 
// this can only be used in HTML environments that properly support canvas!
export default function paint(grid) {
	let canvas = document.createElement('canvas');
	canvas.width = grid.xSize;
	canvas.height = grid.zSize;

	// Find the max value in the data.
	const data = grid.data;
	let max = Math.max(...data);
	if (max === 0) max = 1;

	// Create a canvas context.
	let ctx = canvas.getContext('2d');
	let imgData = ctx.createImageData(canvas.width, canvas.height);

	// Fill up the image data. Note that we have to flip unfortunately, 
	// but that's manageable.
	for (let z = 0; z < grid.zSize; z++) {
		for (let x = 0; x < grid.xSize; x++) {
			let value = data[ x*grid.zSize+z ];
			let offset = 4*(z*grid.xSize+x);
			let alpha = (value / max)*0xff;
			imgData.data[offset+3] = alpha;
		}
	}
	ctx.putImageData(imgData, 0, 0);

	return canvas;

}
