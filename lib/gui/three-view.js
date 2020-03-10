// # three-view.js
"use strict";
const three = require('three');
const { listenToMixin } = require('./util');

// # ThreeView()
// A base class providing some additional functionality to 
const ThreeView = module.exports = class ThreeView extends three.Object3D {

	// ## constructor(opts)
	constructor(opts) {
		super();

		opts = this.options = Object.assign({}, opts);

		// Time to perform custom initialization. Call the initialize method.
		this.initialize(...arguments);

	}

	// ## setElement(el)
	setElement(el) {
		// this.undelegate();
		this.el = el;
		// this.delegate();
	}

	// ## initialize()
	// Overrwrite this method to provide your own custom initialization logic. 
	// Compare it to Backbone's initialize method in the view classes.
	initialize() {}

	// ## needsUpdate(force)
	// Triggers a "needsUpdate" event on the scene this view belongs to which 
	// will cause the scene to re-render. Using this method wisely we're able 
	// to avoid having a constant rendering looping, saving on CPU & GPU power 
	// when doing nothing.
	needsUpdate(force) {
		let scene = this.scene;
		if (scene) scene.dispatchEvent({
			"type": "needsUpdate",
			"message": force
		});
	}

	// ## paint(force)
	// Alias for needsUpdate()
	paint(force) { return this.needsUpdate(force); }

	// ## getOption(prop)
	getOption(prop) {
		let opts = this.options || {};
		return prop in opts ? prop[opts] : void 0;
	}

	// ## group(children)
	// Helper function for creating a group and immediately adding it to the 
	// children.
	group(children) {
		let group = new three.Group();
		if (Array.isArray(children)) {
			for (let child of children) {
				group.add(child);
			}
		}
		this.add(group);
		return group;
	}

	// ## scene
	// A getter that will look up the scene this view belongs to. This is 
	// important to trigger "needsUpdate()" events.
	get scene() {
		let el = this;
		while (el.parent) el = el.parent;
		return el !== this ? el : null;
	}

};
Object.assign(ThreeView.prototype, listenToMixin);