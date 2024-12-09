"use strict";
const os = require('os');
const three = require('three');
const path = require('path');
const fs = require('fs');
const Renderer = require('./renderer');
const Savegame = require('../savegame');

// Do some stuff.
let renderer = window.r = new Renderer({
	"width": window.innerWidth-2,
	"height": window.innerHeight-4,
	"position": [16*64, 1000, 16*64],
	"target": [16*64,0,16*64],
	"perspective": true,
	"far": 1e6,
	// "scale": 10
});
document.body.append(renderer.el);

// Append a box.

let file = path.resolve(os.homedir(), 'Documents/SimCity 4/Regions/Experiments/City - Plopsaland.sc4');
let dbpf = new Savegame(fs.readFileSync(file));

// Read all buildings.
let material = new three.MeshStandardMaterial({
	"color": "darkorange",
	"metalness": 0.6,
	"roughness": 0.75
});

let { buildings } = dbpf;
let box = new three.BoxBufferGeometry(1, 1, 1);
for (let building of buildings) {

	let width = building.maxX - building.minX;
	let height = building.maxY - building.minY;
	let depth = building.maxZ - building.minZ;

	// Determine position.
	let x = building.minX + width/2;
	let y = building.minY + height/2;
	let z = building.minZ + depth/2;

	// Create a box for it.
	let mesh = new three.Mesh(box, material);
	mesh.scale.set(width, height, depth);
	renderer.add(mesh);
	mesh.position.set(x, y, z);
}

let light = new three.DirectionalLight();
light.intensity = 0.8;
light.position.set(16*128, 1000, 16*128);
light.lookAt(16*128, 0, 16*128);
renderer.add(light);

// Paint baby.
console.time('rendering');
renderer.paint(true);
console.timeEnd('rendering');
