// # savegame.js
"use strict";
const DBPF = require('./dbpf');
const FileType = require('./file-types');

// # Savegame()
// A class specifically designed for some Savegame functionality. Obviously 
// extends the DBPF class because savegames are dbpf files.
class Savegame extends DBPF {

	// ## get GID()
	get GID() {
		return this.entries[0].group;
	}

	// ## get lotFile()
	get lotFile() {
		return this.readByType(FileType.LotFile);
	}
	get lots() {
		return this.lotFile;
	}

	// ## get buildingFile()
	get buildingFile() {
		return this.readByType(FileType.BuildingFile);
	}
	get buildings() {
		return this.buildingFile;
	}

	// ## get propFile()
	// Getter for the propfile. If it doesn't exist yet, we'll create it.
	get propFile() {
		return this.readByType(FileType.PropFile);
	}
	get props() {
		return this.propFile;
	}

	// ## get baseTextureFile()
	get baseTextureFile() {
		return this.readByType(FileType.BaseTextureFile);
	}
	get textures() {
		return this.baseTextureFile;
	}

	// ## get itemIndexFile()
	get itemIndexFile() {
		return this.readByType(FileType.ItemIndexFile);
	}
	get itemIndex() {
		return this.itemIndexFile;
	}

	// ## get zoneDeveloperFile()
	get zoneDeveloperFile() {
		return this.readByType(FileType.ZoneDeveloperFile);
	}
	get zones() {
		return this.zoneDeveloperFile;
	}

	// ## get lotDeveloperFile()
	get lotDeveloperFile() {
		return this.readByType(FileType.LotDeveloperFile);
	}

	// ## get floraFile()
	get floraFile() {
		return this.readByType(FileType.FloraFile);
	}

	// ## get COMSerializerFile()
	get COMSerializerFile() {
		return this.readByType(FileType.COMSerializerFile);
	}

	// ## getSimGrid(type, dataId)
	// Finds & return a SimGrid based on type and data id.
	getSimGrid(type, dataId) {
		let { grids } = this.readByType(type);
		return grids.find(grid => grid.dataId === dataId);
	}

	// # getByType(type)
	// This method returns an entry in the savegame by type. If it doesn't 
	// exist yet, it is created.
	getByType(type) {
		let entry = this.entries.find(x => x.type === type);
		if (!entry) {
			const Klass = DBPF.FileTypes[type];
			if (Klass) {
				if (Klass.Array) {
					Klass = Klass.Array;
				}
				let tgi = [type, this.GID, 0];
				entry = this.add(tgi, new Klass());
			}
		}
		return entry || null;
	}

	// ## readByType(type)
	// Helper function that reads an entry when it can be returned.
	readByType(type) {
		let entry = this.getByType(type);
		return entry ? entry.read() : null;
	}

};
module.exports = Savegame;
