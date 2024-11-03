// # make-cohort.js
const fs = require('node:fs');
const DBPF = require('../lib/dbpf.js');
const Exemplar = require('../lib/exemplar.js');

// # random()
// Returns a random number between 0x00000001 and 0xffffffff. Useful for 
// generating unique ids.
function random() {
	return Math.floor(Math.random() * 0xffffffff) + 1;
}

// Exemplar needs to be a cohort
const cohort = new Exemplar();
cohort.id = 'CQZB1###';

// Exemplar Patch Targets (0x0062e78a)
cohort.addProperty(0x0062e78a, 'Uint32', [
	0x166AA05E, 0x98E31A3F,
	0x166aa05e, 0x38e31a53,
	0x166aa05e, 0x98e31906,
]);

// Building Submenus (0xAA1DD399)
cohort.addProperty(0xAA1DD399, 'Uint32', [0x64650DA2]);

let dbpf = new DBPF();
dbpf.add([0x05342861, 0xb03697d1, random()], cohort);
let buffer = dbpf.toBuffer();
