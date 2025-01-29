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

// # draw(canvas, img, overlay, templated)
// The function that actually draws the image on the canvas. Note that by 
// default we apply the icon template to it - meaning drawing the image four 
// times and applying the grayscale, but you can also choose to just rawdog it 
// onto the canvas - useful for existing icons!
async function draw(canvas, { image, overlay, templated }) {

	// Rawdog if possible.
	const ctx = canvas.getContext('2d');
	clear(canvas);
	if (!templated) {
		ctx.drawImage(image, 0, 0);
		return;
	}

	// Draw the image four times. Note that the first time we have to apply the 
	// grayscaling.
	const offsets = getSourceOffset(image);
	for (let i = 0; i < 4; i++) {
		let x = 44*i;
		ctx.save();
		let region = new Path2D();
		region.roundRect(x, 0, 44, 44, 7);
		ctx.clip(region);
		ctx.drawImage(image, ...offsets, x, 0, 44, 44);

		// Apply the menu icon if specified.
		if (withIcon) {
			let w = 6;
			let dx = 7;
			let dy = 7;
			ctx.save();
			ctx.strokeStyle = color;
			ctx.strokeWidth = '1px';
			for (let i = 0; i < 3; i++) {
				ctx.moveTo(x+dx, dy+2*i-0.5);
				ctx.lineTo(x+dx+w, dy+2*i-0.5);
				ctx.stroke();
			}
			ctx.restore();
		}

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
	set(sourceImage = await loadImage(URL.createObjectURL(file)));
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
	if (url.protocol === 'data:') {
		set(sourceImage = await loadImage(url));
		let file = new File([], '<binary>');
		let dtf = new DataTransfer();
		dtf.items.add(file);
		input.files = dtf.files;
		return;
	}
	let search = new URLSearchParams({ url });
	let res = await fetch('/fetch?'+search);
	if (res.status !== 200) return;
	let buffer = await res.arrayBuffer();
	let file = new File([buffer], url);
	setFile(file);
}

// Private state, svelte-like.
let sourceImage = null;
let overlayImage = null;
let message = '';
let templated = true;
let withIcon = false;
let color = '#ffffff';

// # setFile(file)
async function setFile(file) {
	set(sourceImage = null, templated = true);
	await openFile(file);
	let dtf = new DataTransfer();
	dtf.items.add(file);
	input.files = dtf.files;
}

// # useMemo()
// React-like render hook that allows caching a function call based on a deps 
// array.
let former;
function useMemo(fn, deps) {
	if (!former || deps.some((dep, i) => dep !== former[i])) {
		fn();
		former = deps;
	}
}

// # set()
// Helper for automatically calling render.
function set() {
	render();
}

// # render()
// The master render function. This is functionally equivalent to Vue's render 
// function, except that we now have to call it manually.
const input = document.querySelector('input[type="file"]');
const $templated = document.querySelector('input[name="templated"]');
const $withIcon = document.querySelector('input[name="with-icon"]');
const $color = document.querySelector('input[type="color"]');
const canvas = document.querySelector('canvas');
const form = document.querySelector('form');
const h1 = document.querySelector('h1');
function render() {

	// Render the canvas. Note that we need to cache here that in case the 
	// source image did not change, we don't constantly rerender.
	useMemo(() => {
		if (sourceImage && overlayImage) {
			draw(canvas, {
				image: sourceImage,
				overlay: overlayImage,
				templated,
				color,
			});
		} else {
			clear(canvas);
		}
	}, [sourceImage, overlayImage, templated, withIcon, color]);

	// Update the heading text.
	h1.textContent = message;
	$templated.checked = templated;
	$withIcon.disabled = !templated;

}

// Load the overlay as soon as possible.
loadImage('/overlay.png').then(img => set(overlayImage = img));

// Setup code goes below.
input.addEventListener('change', async event => {
	let [file] = event.target.files;
	setFile(file, { dispatch: false });
});

// Add the save listener.
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
	setFile(input.files[0]);
});

// Handle paste events.
window.addEventListener('paste', e => {
	let [file] = e.clipboardData.files;
	if (file) {
		setFile(file);
		return;
	}

	// If no files were pasted, but only text, then treat it as a url being 
	// pasted.
	let [item] = e.clipboardData.items;
	if (item.kind === 'string') {
		let text = e.clipboardData.getData('text');
		try {
			fetchUrl(new URL(text));
			set(sourceImage = null, templated = true);
		} catch {}
	}
});

// Listen to the raw being checked or not.
$templated.addEventListener('input', event => {
	set(templated = event.target.checked);
});
$withIcon.addEventListener('input', event => {
	set(withIcon = event.target.checked);
});
$color.addEventListener('input', event => {
	set(color = event.target.value);
});

// Get the configuration data.
let config = await fetch('/data').then(res => res.json());
({ message, templated = true } = config);
if (config.default) {
	fetchUrl(new URL(config.default));
}

// Perform the initial render now.
render();
