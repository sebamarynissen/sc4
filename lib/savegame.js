// # savegame.js
"use strict";
const DBPF = require('./dbpf');
const FileType = require('./file-types');

// # Savegame()
// A class specifically designed for some Savegame functionality. Obviously 
// extends the DBPF class because savegames are dbpf files.
module.exports = class Savegame extends DBPF {

	// ## get lotFile()
	get lotFile() {
		let entry = this.entries.find(x => x.type === FileType.LotFile);
		return entry ? entry.read() : null;
	}

};