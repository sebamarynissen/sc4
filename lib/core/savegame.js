// # savegame.js
import DBPF from './dbpf.js';
import FileType from './file-types.js';
import { getConstructorByType } from './filetype-map.js';

// # Savegame()
// A class specifically designed for some Savegame functionality. Obviously 
// extends the DBPF class because savegames are dbpf files.
export default class Savegame extends DBPF {

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

	// ## get zoneManager()
	get zoneManager() {
		return this.readByType(FileType.ZoneManager);
	}

	// ## get COMSerializerFile()
	get COMSerializerFile() {
		return this.readByType(FileType.COMSerializerFile);
	}

	// ## get lineItemFile()
	get lineItemFile() {
		return this.readByType(FileType.LineItem);
	}
	get lineItems() {
		return this.lineItemFile;
	}

	// ## get departmentBudgetFile()
	get departmentBudgetFile() {
		return this.readByType(FileType.DepartmentBudget);
	}

	// ## get pipes()
	get pipes() {
		return this.readByType(FileType.PipeFile);
	}

	// ## get plumbingSimulator()
	get plumbingSimulator() {
		return this.readByType(FileType.PlumbingSimulator);
	}

	// ## get regionView()
	get regionView() {
		return this.readByType(FileType.RegionViewFile);
	}

	// ## get terrain()
	get terrain() {
		let entry = this.entries.find(entry => {
			return (
				entry.type === FileType.TerrainMap &&
				entry.instance === 0x00000001
			);
		});
		return entry ? entry.read() : null;
	}

	// ## get network()
	get network() {
		return this.readByType(FileType.NetworkFile);
	}

	// ## get prebuiltNetwork()
	get prebuiltNetwork() {
		return this.readByType(FileType.PrebuiltNetwork);
	}

	// ## get networkIndex()
	get networkIndex() {
		return this.readByType(FileType.NetworkIndex);
	}

	// ## getSimGrid(type, dataId)
	// Finds & return a SimGrid based on type and data id.
	getSimGrid(type, dataId) {
		let grids = this.readByType(type);
		return grids.find(grid => grid.dataId === dataId);
	}

	// # getByType(type)
	// This method returns an entry in the savegame by type. If it doesn't 
	// exist yet, it is created.
	getByType(type) {
		let entry = this.find({ type });
		if (!entry) {
			let Constructor = getConstructorByType(type);
			if (Constructor) {
				let tgi = [type, this.GID, 0];
				if (Array.isArray(Constructor)) {
					[Constructor] = Constructor;
					entry = this.add(tgi, []);
				} else {
					entry = this.add(tgi, new Constructor());
				}
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

}
