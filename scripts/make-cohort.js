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

let gis = [];
let input = new DBPF(fs.readFileSync('C:\\Users\\sebam\\Documents\\SimCity 4\\Plugins\\075-my-plugins\\Belgian Roadpack 01\\Belgian Sign Set 01.dat'));
collect(input, gis);

// Exemplar needs to be a cohort
const cohort = new Exemplar();
cohort.id = 'CQZB1###';

// Exemplar Patch Targets (0x0062e78a)
cohort.addProperty(0x0062e78a, 'Uint32', gis);

// Building Submenus (0xAA1DD399)
cohort.addProperty(0xAA1DD399, 'Uint32', [0x64650DA2]);

let dbpf = new DBPF();
dbpf.add([0x05342861, 0xb03697d1, random()], cohort);
let buffer = dbpf.toBuffer();
fs.writeFileSync(`C:\\Users\\sebam\\Documents\\SimCity 4\\Plugins\\075-my-plugins\\Belgian Roadpack 01\\submenus.dat`, buffer);

function collect(dbpf, gis = []) {
	let entries = dbpf.entries.filter(entry => entry.type === 0x6534284a);
	for (let entry of entries) {

		// Check if the exemplar is a building exemplar
		let ex = entry.read();
		let isBuilding = ex.props.some(prop => prop.id === 0x10 && prop.value === 0x02);
		if (!isBuilding) continue;
		let [type, group, instance] = entry.tgi;
		gis.push(group, instance);

	}
	return gis;
}
