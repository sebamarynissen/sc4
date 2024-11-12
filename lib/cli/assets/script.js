// ## loadImage(url)
// Loads an image object from the given url.
function loadImage(url) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.crossOrigin = true;
		img.src = url;
	});
}

// # img()
// Calculates the source offsets to use from the image based on the size of the 
// image. In the future we might allow repositioning here.
function getSourceOffset(img) {
	let { width, height } = img;
	let sx, sy, sWidth, sHeight;
	if (width > height) {
		sx = (width-height)/2;
		sy = 0;
		sWidth = height;
		sHeight = height;
	} else {
		sx = 0;
		sy = (height-width)/2;
		sWidth = width;
		sHeight = width;
	}
	return [sx, sy, sWidth, sHeight];
}

// # draw(canvas, img, overlay)
// Performs the ct
async function draw(canvas, img, overlay) {

	// Draw the image four times. Note that the first time we have to apply the 
	// grayscaling.
	const ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	const offsets = getSourceOffset(img);
	for (let i = 0; i < 4; i++) {
		let x = 44*i;
		ctx.save();
		let region = new Path2D();
		region.roundRect(x, 0, 44, 44, 7);
		ctx.clip(region);
		ctx.drawImage(img, ...offsets, x, 0, 44, 44);
		if (i === 0) {
			applyGrayscale(ctx);
		}
		ctx.restore();
	}

	// At last draw the overlay.
	ctx.drawImage(overlay, 0, 0, 176, 44);

}

// # applyGrayscale(ctx)
// Applies the grayscaling of the first image, in the same way the GIMP template 
// does it.
function applyGrayscale(ctx) {
	ctx.save();
	ctx.fillStyle = 'white';
	ctx.filter = 'opacity(0.7)';
	ctx.globalCompositeOperation = 'saturation';
	ctx.fillRect(0, 0, 44, 44);
	ctx.restore();
	ctx.save();
	ctx.fillStyle = 'white';
	ctx.globalCompositeOperation = 'source-over';
	ctx.filter = 'opacity(0.2)';
	ctx.fillRect(0, 0, 44, 44);
	ctx.restore();
}

// # toBuffer(canvas)
// Gets the canvas' contents as an array buffer so that we can save them to the 
// server.
function toBuffer(canvas) {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			const reader = new FileReader();
			reader.onload = () => {
				resolve(reader.result);
			};
			reader.readAsArrayBuffer(blob);
		});
	});
}

// Load the overlay as soon as possible.
const loadOverlay = loadImage('/overlay.png');

// Setup code goes below.
const input = document.querySelector('input[type="file"]');
const canvas = document.querySelector('canvas');
input.addEventListener('change', async event => {
	let [file] = event.target.files;
	let url = URL.createObjectURL(file);
	await draw(canvas, ...await Promise.all([loadImage(url), loadOverlay]));
});

// Add the save listener.
const form = document.querySelector('form');
form.addEventListener('submit', async event => {
	event.preventDefault();
	await fetch(form.getAttribute('action'), {
		method: form.getAttribute('method') || 'POST',
		headers: {
			'Content-Type': 'image/png',
		},
		body: await toBuffer(canvas),
	});
});
