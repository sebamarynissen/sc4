// # scene.js
"use strict";
const three = require('three');

// # Scene()
// Extension of a native three.js scene.
const Scene = module.exports = class Scene extends three.Scene {

	// ## needsUpdate(force)
	// Call this method when you want to signal to all renderers that the 
	// scene should be repainted.
	needsUpdate(force) {
		this.dispatchEvent({"type": "needsUpdate", "message": force});
		return this;
	}

	// ## paint(force)
	// Alias for needsUpdate()
	paint(force) { return this.needsUpdate(force); }

};