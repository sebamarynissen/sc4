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

// # clear()
// Clears the canvas
function clear(canvas) {
	const ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// # draw(canvas, img, overlay)
// Performs the ct
async function draw(canvas, img, overlay) {

	// Draw the image four times. Note that the first time we have to apply the 
	// grayscaling.
	const ctx = canvas.getContext('2d');
	clear(canvas);
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

// # openIcon(file)
async function openFile(file) {
	let url = URL.createObjectURL(file);
	await draw(canvas, ...await Promise.all([loadImage(url), loadOverlay]));
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

// # fetchUrl(url)
// Fetches a image from a url. Note that we pass by the server for this because 
// otherwise we might not be able to serialize the canvas to a buffer because of 
// cors!
async function fetchUrl(url) {
	let search = new URLSearchParams({ url });
	let res = await fetch('/fetch?'+search);
	if (res.status !== 200) return;
	let buffer = await res.arrayBuffer();
	let file = new File([buffer], url);
	let dtf = new DataTransfer();
	dtf.items.add(file);
	input.files = dtf.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

// Load the overlay as soon as possible.
const loadOverlay = loadImage('/overlay.png');

// Setup code goes below.
const input = document.querySelector('input[type="file"]');
const canvas = document.querySelector('canvas');
input.addEventListener('change', event => {
	clear(canvas);
	let [file] = event.target.files;
	openFile(file);
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
	window.close();
});

// Setup the drag/drop behavior.
const dropArea = document.body;
dropArea.addEventListener('dragover', e => {
	e.preventDefault();
	e.target.style.background = '#eee';
});
dropArea.addEventListener('dragleave', e => {
	e.target.style.background = '';
});
dropArea.addEventListener('drop', e => {
	e.preventDefault();
	e.target.style.background = '';
	input.files = e.dataTransfer.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));
});

// Handle paste events.
window.addEventListener('paste', e => {
	let [item] = e.clipboardData.items;
	if (item.kind === 'string') {
		let text = e.clipboardData.getData('text');
		try {
			fetchUrl(new URL(text));
		} catch {}
	} else {
		input.files = e.clipboardData.files;
		input.dispatchEvent(new Event('change', { bubbles: true }));
	}
});

// Get the configuration data.
let config = await fetch('/data').then(res => res.json());
document.querySelector('h1').textContent = config.message;
if (config.default) {
	fetchUrl(config.default);
}
