// # renderer.js
"use strict";
const three = require('three');
const _ = require('lodash');
const {
	isNumber, isFunction, listenToMixin, xor, noop
} = require('./util');
const Scene = require('./scene');
const OrbitControls = require('./orbit-controls');

// Some shared stuff, such as the raycaster & mouse vector.
const raycaster = new three.Raycaster();
const mouse = new three.Vector2();

// # Renderer()
// A wrapper class around a three.js renderer.
const Renderer = module.exports = class Renderer {

	// ## constructor(opts)
	// Constructor for a renderer.
	constructor(opts) {
		
		opts = this.options = Object.assign({
			"alpha": true,
			"antialias": true,
			"preserveDrawingBuffer": true,
			"scale": 1,
			"perspective": true,
			"fov": 75,
			"near": 1,
			"far": 10000,
			"scale": 1
		}, opts);

		// Setup our reactive state by picking some stuff from the options.
		// this._watchers = [];
		// let state = Object.create(null);
		Object.assign(this, _.pick(opts, [
			'alpha', 'antialias', 'preserveDrawingBuffer', 'scale',
			'perspective', 'fov', 'near', 'far'
		]));
		// this.getContext().include(state);

		this._nextRender = null;
		this.ensureElement();

		class Event {
			constructor(type, originalEvent) {
				this.type = type;
				this.originalEvent = originalEvent;
				this.isPropagationStopped = false;
				this.target = null;
			}
			stopImmediatePropagation() {
				this.isPropagationStopped = true;
			}
			stopPropagation() {
				return this.stopImmediatePropagation();
			}
		};

		const types = ['click', 'dblclick'];
		for (let type of types) {
			this.el.addEventListener(type, e => {
				let objects = traverse(this.scene, type);
				if (!objects.length) return;
				let intersects = this.raycast(e.offsetX, e.offsetY, {
					"objects": objects,
					"recursive": false
				});
				if (!intersects.length) return;

				// Loop all intersections that we have found. Note that certain 
				// objects can be intersected twice, so we'll group them by object 
				// because we only want to fire 1 event per object.
				let groups = new Map();
				for (let ix of intersects) {
					let {object} = ix;
					let arr = groups.get(object);
					if (!arr) groups.set(object, arr = []);
					arr.push(ix);
				}

				// Dispatch events. Note that automatically the objects will be 
				// sorted by intersection nearness. This is important in order to 
				// stop bubbling to "deeper" objects.
				for (let [object, points] of groups.entries()) {
					let event = new Event(type, e);
					object.dispatchEvent(event);
					if (event.isPropagationStopped) break;
				}

			});
		}

		function time(fn) {
			return function() {
				console.time('time');
				try {
					return fn.apply(this, arguments);
				} finally {
					console.timeEnd('time');
				}
			};
		}

		let hover = new Set();
		this.el.addEventListener('mousemove', e => {
			let objects = traverse(this.scene, ['mousemove', 'mouseover']);
			let intersects = this.raycast(e.offsetX, e.offsetY, {
				"objects": objects,
				"recursive": false
			});
			if (intersects.length > 1) intersects.length = 1;

			// Loop all intersections that we have found and group them by 
			// object because a single object may be intersected twice.
			let groups = new Map();
			for (let ix of intersects) {
				let {object} = ix;
				let arr = groups.get(object);
				if (!arr) groups.set(object, arr = []);
				arr.push(ix);
			}

			// Carry out a diff operation between the obejcts currently 
			// hovered, and the objects hovered in the former iteration.
			let over = new Set(), out = new Set(), move = new Set();
			for (let object of groups.keys()) {
				if (!hover.has(object)) {
					over.add(object);
				}
			}
			for (let object of hover) {
				if (!groups.has(object)) {
					out.add(object);
				}
			}
			hover = new Set(groups.keys());

			// Dispatch our "over" events first.
			for (let object of over) {
				let event = new Event('mouseover', e);
				let ix = groups.get(object);
				event.intersection = ix[0];
				event.intersections = ix;
				object.dispatchEvent(event);
				if (event.isPropagationStopped) break;
				break;
			}

			// Dispatch the "move" events. Note that this should also happen 
			// for the objects we just dispatched an "over" event for!
			for (let object of groups.keys()) {
				let event = new Event('mousemove', e);
				let ix = groups.get(object);
				event.intersection = ix[0];
				event.intersections = ix;
				object.dispatchEvent(event);
				if (event.isPropagationStopped) break;
				break;
			}

			// At last dispatch the "mouseout" events.
			for (let object of out) {
				let event = new Event('mouseout', e);
				object.dispatchEvent(event);
			}

		});

		this.el.addEventListener('mouseout', e => {
			for (let object of hover) {
				let event = new Event('mouseout', e);
				object.dispatchEvent(event);
			}
			hover.clear();
		});

	}

	// ## ensureElement()
	// Ensures that we have a canvas element set based on the options that 
	// were specified.
	ensureElement() {
		let opts = this.options;
		let el = opts.el;
		if (typeof el === 'string') {
			el = document.querySelector(el);
		}
		if (!el) {
			el = document.createElement('canvas');
		}

		// If the element that was given is not a canvas, then add a canvas to 
		// it.
		if (!(el instanceof HTMLCanvasElement)) {
			let parent = el;
			parent.append(el = document.createElement('canvas'));
		}

		// Check whether a width & height were specified explicitly in the 
		// options.
		let {width, height} = opts;
		if (isNumber(width)) el.width = width;
		if (isNumber(height)) el.height = height;

		return this.el = el;

	}

	// ## raycast(x, y, opts)
	// Performs a raycast on the given objects starting from the (x,y)
	// coordinates. If "ndc" is set to true, it is assumed that the 
	// coordinates are already given in ndc.
	// Note: we're using a shared raycaster here. This way we don't need a 
	// specific raycast per renderer.
	raycast(x, y, opts) {

		// First of all, if the coordiantes are not yet in ndc, convert.
		opts = opts || {};
		if (opts.ndc !== true) {
			x =  2*(x / this.width)  - 1;
			y = -2*(y / this.height) + 1;
		}

		// Carry out the raycast.
		mouse.set(x, y);
		raycaster.setFromCamera(mouse, this.camera);
		let recursive = opts.recursive === true;
		let objects = opts.objects || [this.scene];
		return raycaster.intersectObjects(objects, recursive);

	}

	// ## ensureScene()
	// This method is called "just in time" before the first render to ensure 
	// that a scene is present to be rendered. By default we'll pick the scene 
	// from the options, or create one if not given. If you want to alter the 
	// behavior, override this method.
	ensureScene() {
		if (!this.hasOwnProperty('scene')) {
			let scene;
			Object.defineProperty(this, 'scene', {
				"configurable": true,
				"enumerable": true,
				"writable": true,
				"value": scene = (this.getOption('scene') || new Scene())
			});
			let bg = this.getOption('background');
			if (bg) {
				if (typeof bg !== 'object') bg = new three.Color(bg);
				scene.background = bg;
			}
		}
		return this.scene;
	}

	// ## get scene()
	// Getter that will return the scene and ensure that one exists. Note that 
	// the "ensureScene()" method will shadow this method later on, so in 
	// principle this is only called the very first time this.scene() is 
	// accessed!
	get scene() {
		this.ensureScene();
		return this.scene;
	}

	// ## ensureRenderer()
	// Performs the actual setup work such as creating the raw three.js 
	// WebGLRenderer.
	ensureRenderer() {

		// Create the WebGL renderer by passing it our element we're rendering 
		// to - a canvas obviously. Note that by now the canvas should have 
		// received a size because the size should be passed to the WebGL 
		// Renderer. Note that we do this using a "watch" method. This means 
		// that if the reactivity system is triggered, the watcher function 
		// will run again and a new renderer will be created.
		// Note: don't change the alpha, antialias, or preserveDrawingBuffer 
		// properties too often! It's quite expensive and very error prone!
		this.watch(function() {

			// If a renderer already existed before, we'll need to destroy the 
			// WebGL context for it and then update our canvas element with a 
			// fresh one. The requirement to create a fresh canvas is due to 
			// the fact that the alpha & antialias properties are stored in 
			// the gl context.
			if (this._renderer) {
				this._renderer.forceContextLoss();
				let old = this.el;
				let canvas = this.el = document.createElement('canvas');
				canvas.width = old.width;
				canvas.height = old.height;
				old.replaceWith(canvas);

				// Create new orbit controls.
				this.createControls();

			}
			
			// Create a new renderer.
			this._renderer = new three.WebGLRenderer({
				"canvas": this.el,
				"alpha": this.alpha,
				"antialias": this.antialias,
				"preserveDrawingBuffer": this.preserveDrawingBuffer,
			});

			// If we're not initializing, schedule an initial render.
			this.paint();

		});
		let renderer = this._renderer;
		renderer.setSize(this.width, this.height);

		// Ensure the we have a scene to be rendered. We'll setup an event 
		// listener as well to listen for "needsUpdate" events on the scene. 
		// As such a scene can signal any renders easily that it needs to be 
		// updated on the next render.
		this.ensureScene();
		this.listenTo(this.scene, 'needsUpdate', force => this.paint(force));

		// Set up a camera, but in a reactive way using a watcher. This means 
		// that the user can change the perspective on the fly.
		// Set up a camera, but in a reactive way using a watcher. This means 
		// that if any of the reactive dependencies that are "touched" change, 
		// the watcher will run again. Taking this into account, we can change 
		// the camera settings easily using the reactive properties defined on 
		// the renderer.
		this.watch(() => this.updateCamera());

	}

	// ## updateCamera()
	// Carries out an update of the camera. This method can be called 
	// manually, but normally this method will be called from within a watcher 
	// so that the camera will update itself automatically when one of the 
	// reactive dependencies changes.
	updateCamera() {

		// First of all we'll check if we have to create an entirely new 
		// camera. This is the case if there was either no camera set, **or** 
		// the type of camera has changed.
		let camera = this.camera;
		let perspective = this.perspective;
		if (!camera || xor(camera.isPerspectiveCamera, this.perspective)) {
			this.createCamera();
			camera = this.camera;
		}

		// Update the camera's properties based on whether we're using a 
		// perspective or orthographic camera.
		if (perspective) {
			camera.fov = this.fov;
			camera.aspect = this.ratio;
		}
		else {
			let scale = 2*this.scale;
			let height = this.height / scale;
			let width = this.width / scale;
			camera.left = -width;
			camera.right = width;
			camera.top = height;
			camera.bottom = -height;
		}

		// General properties, independent of perspective or orthographic.
		camera.near = this.near;
		camera.far = this.far;

		// Update the camera's projection matrix.
		camera.updateProjectionMatrix();
		this.paint();
		return this;

	}

	// ## createCamera()
	// Creates a new camera object. Shouldn't be called manually because this 
	// is called from within the reactive watcher. If a camera already existed 
	// before, we'll copy it's position as well as its orbit controls.
	createCamera() {
		let old = this.camera;
		let camera;
		if (this.perspective) {
			camera = this.camera = new three.PerspectiveCamera();
		}
		else {
			camera = this.camera = new three.OrthographicCamera();
		}
		camera.target = new three.Vector3();

		// If a camera already existed before, copy its position as well as 
		// its target so that we can use it in the new orbit controls.
		if (old) {
			camera.position.copy(old.position);
			camera.target.copy(old.target);
		}
		else {
			this.setInitialCameraPosition();
		}

		this.createControls();
		return this;
	}

	// ## createControls()
	// Creates orbit controls for a new camera. Also called when the 
	// renderer's canvas has changed.
	createControls() {
		if (this.controls) {
			this.controls.dispose();
			this.stopListening(this.controls);
		}

		// Set up new orbit controls.
		this.controls = new OrbitControls(this.camera, this.el);
		this.controls.enableKeys = false;
		this.listenTo(this.controls, 'change', () => this.paint());
		return this;

	}

	// ## setInitialCameraPosition()
	// This function will set the initial camera position & target. By default 
	// we'll pick this from the options, but you can override this method if 
	// you want.
	setInitialCameraPosition() {

		let target = this.getOption('target') || [0,0,0];
		this.camera.target.set(...target);

		// If we don't find a position, we'll calculate the bounding box of 
		// the entire scene.
		let pos = this.getOption('position');
		if (!pos) {
			if (this.scene.children.length === 0) {
				pos = [0,1,0];
			}
			else {
				let bbox = new three.Box3().setFromObject(this.scene);
				throw new Error('Calculating the position automatically not supported yet!');
			}
		}
		this.camera.position.set(...pos);

	}

	// ## paint(force)
	// This method can be used to schedule a rerender of the scene. This 
	// method will also perform some clever tricks such that multiple calls to 
	// the paint method during the same event loop will only trigger a single 
	// render. Nevertheless, if you want to force-render though, this is also 
	// possible by calling renderer.paint(true).
	// Note: this method does **not** return a promise, but simply the 
	// renderer itself! The reason is that creating promises is relatively 
	// expensive and we may call the paint method **a lot**. Hence we should 
	// only create a promise when explicitly needed. You can do this by 
	// accessing the "ready" property.
	paint(force) {

		// If no WebGL renderer & camera etc. has been set up yet, it's time 
		// to do it now (Just In Time).
		if (!this._renderer) {
			this.ensureRenderer();
		}

		// Handle forced paints here.
		// TODO: When a paint is forced, can't we cancel a scheduled render?
		if (force === true) {

			// If a render call was still scheduled, cancel it because we're 
			// force-rendering now and don't need the render to be scheduled 
			// any longer.
			if (isNumber(this._nextRender)) {
				window.cancelAnimationFrame(this._nextRender);
			}

			// Finally, actually render.
			this._renderer.render(this.scene, this.camera);
			this._nextRender = void 0;
			this._nextRenderPromise = null;
			return this;

		}

		// If we reach this point we don't need to render immediately. Defer 
		// to the next animation frame, but only if there's not yet a render 
		// call scheduled for the next animation frame. Compare it to how Vue 
		// does it.
		if (!isNumber(this._nextRender)) {
			let cbs = this._onNextRender = [];
			this._nextRender = window.requestAnimationFrame(() => {
				this._nextRender = void 0;
				this.paint(true);
				for (let cb of cbs) cb.call(this);
			});
		}
		
		// Done.
		return this;

	}

	// ## get ready
	// Getter that returns the promise that resolves after the next scheduled 
	// render has occurred.
	get ready() {

		// First of all, check if there's still a render call scheduled. If 
		// not, we're done right away.
		if (!isNumber(this._nextRender)) return Promise.resolve();

		// Now check if a render promise was already created.
		if (this._nextRenderPromise) return this._nextRenderPromise;
		else {
			return this._nextRenderPromise = new Promise(resolve => {
				this._onNextRender.push(resolve);
			});
		}
	}

	// ## getOption(prop)
	getOption(prop) {
		let opts = this.options || {};
		return prop in opts ? opts[prop] : undefined;
	}

	// ## add(el)
	// Shortcut for adding stuff on the scene.
	add(el) {
		if (!this.scene) this.ensureScene();
		this.scene.add(el);
		this.paint();
		return this;
	}

	// ## destroy()
	// Call this method to destroy the renderer in it's entirety.
	destroy() {
		if (this._renderer) {
			this._renderer.forceContextLoss();
			this._renderer = null;
			this.scene = null;
		}
		this.stopListening();

		// Destroy all watchers.
		let i = this._watchers.length;
		while (i--) {
			this._watchers[i].teardown();
		}

		// If we still have controls, get rid of them.
		this.controls && this.controls.dispose();

	}

	// ## toBlob(opts)
	// Returns the renderer's contents as a blob.
	toBlob(opts) {
		opts = opts || {};
		let type = opts.type;
		let quality = type === 'image/jpeg' ? opts.quality : void 0;
		return new Promise(resolve => {
			this.el.toBlob(resolve);
		}, type, quality);
	}

	// ## toImage(opts)
	// Returns a buffer - wrapped up in a promise - with the image data for 
	// the given mime type. This is the method that both toPNG() and toJPG() 
	// use. Hence it is encourage to use toPNG() and toJPG() instead.
	async toImage(opts) {
		let blob = await this.toBlob(opts);
		let reader = new FileReader();
		return new Promise(resolve => {
			reader.onload = function() {
				if (typeof Buffer === 'undefined') {
					resolve(new Uint8Array(reader.result));
				} else {
					resolve(Buffer.from(reader.result));
				}
			};
			reader.readAsArrayBuffer(blob);
		});
	}

	// ## toPNG()
	// Returns a buffer that contains png data of the scene (as a promise).
	toPNG() {
		return this.toImage({"type": "image/png"});
	}

	// ## toJPG()
	// Returns a buffer containing jpg data of the scene (as a promise).
	toJPG(quality) {
		return this.toImage({"type": "image/jpeg", "quality": quality});
	}

	// ## ortho()
	get ortho() { return !this.perspective; }
	set ortho(value) { this.perspective = !value; }

	// ## height
	get height() { return this.el.height; }
	set height(value) { this.el.height = height; }

	// ## width
	get width() { return this.el.width; }
	set width(value) { this.el.width = width; }

	// ## ratio
	get ratio() { return this.width / this.height; }

	// ## background
	get background() { return this.scene.background; }
	set background(bg) { this.scene.background = bg; this.paint(); }

	// No reactivity here, so mock watch.
	watch(fn) {
		return fn.call(this);
	}

};

// Mixin listen functionality.
Object.assign(Renderer.prototype, listenToMixin);

// Helper function for traversing a three.js object and all of its children to 
// collect all children that have listeners for the given event.
function traverse(obj, evt, all) {

	all = all || [];
	let listeners = obj._listeners;

	// If the object is visible **and** has attached at least one listener for 
	// the given events, it's eligible to be investigated. Put it in.
	if (obj.visible && listeners) {
		if (Array.isArray(evt)) {
			for (let name of evt) {
				if (listeners[name]) {
					all.push(obj);
					break;
				}
			}
		}
		else if (listeners[evt]) {
			all.push(obj);
		}
	}

	// Recusirve: on.
	for (let child of obj.children) {
		traverse(child, evt, all);
	}

	return all;

}