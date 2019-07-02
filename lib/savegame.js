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

	// ## get buildingFile()
	get buildingFile() {
		let entry = this.entries.find(x => x.type === FileType.BuildingFile);
		return entry ? entry.read() : null;
	}

	// ## get propFile()
	get propFile() {
		let entry = this.entries.find(x => x.type === FileType.PropFile);
		return entry ? entry.read() : null;
	}

	// ## get baseTextureFile()
	get baseTextureFile() {
		let entry = this.getByType(FileType.BaseTextureFile);
		return entry ? entry.read() : null;
	}

	// ## get itemIndexFile()
	get itemIndexFile() {
		let entry = this.getByType(FileType.ItemIndexFile);
		return entry ? entry.read() : null;
	}

	// ## get zoneDeveloperFile()
	get zoneDeveloperFile() {
		let entry = this.getByType(FileType.ZoneDeveloperFile);
		return entry ? entry.read() : null;
	}

	// ## get lotDeveloperFile()
	get lotDeveloperFile() {
		let entry = this.getByType(FileType.LotDeveloperFile);
		return entry ? entry.read() : null;
	}

	// ## get floraFile()
	get floraFile() {
		let entry = this.getByType(FileType.FloraFile);
		return entry ? entry.read() : null;
	}

	// # getByType(type)
	getByType(type) {
		return this.entries.find(x => x.type === type);
	}

};